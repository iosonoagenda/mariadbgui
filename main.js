// Dependencies
const {app, BrowserWindow, dialog, ipcMain, Menu, shell} = require('electron');
const {createConnection} = require('mariadb');
const {GITHUB_USER, GITHUB_KEY, DEV_TOOLS} = require('./env.json');
const fs = require('fs');
const {homedir} = require('os');
const {Octokit} = require('@octokit/core');
const path = require("path");
const {name, version} = require('./package.json');
const readline = require('readline');

// Variables & Constants
const anyExt = /(?!^.)(\.(.)*)/;
const cli = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const configs = {
    askOnExists: true,
    checkUpdates: true,
    canDisplay: true,
    lang: null,
    actionsDefaults: {
        manage: 3,
        question: 1,
        info: 0,
    },
};
const configsDir = path.resolve(homedir(), '.chongett.mariadbgui');
const configsFile = path.resolve(configsDir, 'configs.json');
const dialogs = {
    ask: (title, message, actionsKey) => {
        if (typeof trans.actions[actionsKey] !== 'undefined') {
            //Get options for the given valid key
            const options = Object.values(trans.actions[actionsKey]);
            //Get default button id
            const defaultId = configs.actionsDefaults[actionsKey];
            if (configs.canDisplay) {
                //Show a system dialog
                return dialog.showMessageBoxSync(win, {
                    title,
                    message,
                    options,
                    defaultId
                });
            } else {
                let result = defaultId;
                //Show a cli question
                cli.question(`${title}: ${message} [${options.map((option, index) => `${result === index ? index : `[${index}]`} = ${option}`).join(', ')}] `, answer => {
                    const parsed = parseInt(answer.toString());
                    if (parsed >= 0 && parsed < options.length) {
                        result = parsed;
                    }
                });
                return result;
            }
        } else {
            throw new Error(format(trans.errors.notFound, actionsKey));
        }
    },
    error: (message = '', title = trans.errors.general) => {
        if (configs.canDisplay) {
            //Show error dialog
            dialog.showErrorBox(title, message);
        } else {
            //Print error to console
            console.error(title, '==>', message);
        }
    },
    open: (title, defaultPath = homedir(), filters = fileFilters.input) => {
        defaultPath = defaultPath || homedir();
        filters = filters || fileFilters.input;
        if (configs.canDisplay) {
            return dialog.showOpenDialogSync(win, {
                title,
                defaultPath,
                properties: ['openFile', 'multiSelections'],
                filters,
            });
        } else {
            let res = undefined;
            const ffMap = fileFilters.map(ff => `${ff.name}`).join(', ');
            const separators = '[,;]';
            cli.question(
                `${title} [${defaultPath}: [${ffMap}]; ${format(trans.separators, separators)}]`,
                answer => {
                    if (answer.length > 0) {
                        res = answer.split(new RegExp(separators)).map(a => path.resolve(defaultPath, a.trim()));
                    }
                });
            return res;
        }
    },
    save: (title, defaultPath = configsDir, filters = fileFilters.output) => {
        defaultPath = defaultPath || configsDir;
        filters = filters || fileFilters.output;
        if (configs.canDisplay) {
            return dialog.showSaveDialogSync(win, {
                title,
                defaultPath,
                properties: ['createDirectory', 'showOverwriteConfirmation'],
                filters,
            });
        } else {
            let res = undefined;
            cli.question(
                `${title} [${defaultPath}: [${fileFilters.map(ff => `${ff.name}`).join(', ')}]]`,
                answer => {
                    if (answer.length > 0) {
                        res = path.resolve(defaultPath, answer);
                    }
                });
            return res;
        }
    }
};
const ext = {
    input: {
        lang: 'mdglang',
        conn: 'mdgconn',
    },
    output: {
        lang: 'lang.json',
        conn: 'conn.json',
    },
};
const fileFilters = {
    input: [],
    output: [],
};
const trans = {
    actions: {
        home: {
            create: 'New connection',
        },
        connection: {
            connect: 'Connect',
            edit: 'Edit',
            save: 'Save',
        },
        info: {
            ok: 'Ok',
        },
        manage: {
            replace: 'Replace',
            replaceAll: 'Replace all',
            skip: 'Skip',
            skipAll: 'Skip all',
        },
        question: {
            dontAskAgain: "Don't ask again",
            no: "No",
            yes: "Yes",
        },
    },
    errors: {
        general: 'Error',
        notAccessible: "'{0}' isn't accessible.",
        notFound: "'{0}' not found.",
    },
    file: {
        export: {
            title: "Export file",
        },
        filter: {
            any: 'Any supported file',
            conn: 'Conn file (*.{0})',
            lang: 'Lang file (*.{0})',
        },
        import: {
            ask: "File {0} already exists. What I have to do?",
            title: "Import file(s)",
            message: "Imported {0} file(s) successfully",
        },
        write: {
            title: 'Write file',
        },
    },
    menu: {
        close: 'Close',
        file: 'File',
        lang: 'Lang',
        minimize: 'Minimize',
        quit: 'Quit',
    },
    newerRelease: {
        title: "Newer release",
        message: 'There is a newer release ({0}). Open site?',
    },
    separators: 'Separators: {0}'
};
const transBkp = Object.assign({}, trans);
let win, db;

// Methods
const format = (fmt = '', ...values) => {
    //First, store format to result variable
    let res = fmt;
    //Then, for any values...
    values.forEach((v, i) => {
        //...create a regular expression for index...
        const regex = new RegExp(`/{${i}}/`, 'g');
        //...and replace any found parameter with value
        res = res.replaceAll(regex, v.toString());
    });
    return res;
};
const progress = (percentage = 0) => {
    percentage = Math.round(percentage || 0);
    if (configs.canDisplay) {
        win.webContents.send('progress:change', percentage);
    } else {
        console.log(`${percentage}%`)
    }
};
const createMenu = () => {
    const template = [{
        role: 'fileMenu',
        label: trans.menu.file,
        submenu: [
            {
                label: trans.menu.lang,
                submenu: fs.readdirSync(configsDir)
                    .filter(file => file.endsWith(ext.output.lang))
                    .map(lang => {
                        return {
                            label: path.basename(lang, `.${ext.output.lang}`),
                            click: () => {
                                configs.lang = path.basename(lang, `.${ext.output.lang}`);
                                saveConfigs();
                                app.relaunch();
                                app.exit();
                            }
                        };
                    })
            },
            {
                role: 'minimize',
                label: trans.menu.minimize
            },
            {
                role: 'close',
                label: trans.menu.close
            },
            {
                role: 'quit',
                label: trans.menu.quit
            }
        ]
    }];
    return Menu.buildFromTemplate(template);
};
const createWindow = () => {
    //First, check if it can display
    if (configs.canDisplay) {
        //Create BrowserWindow to enable display app
        win = new BrowserWindow({
            width: 640,
            height: 480,
            icon: path.resolve(__dirname, 'build', 'icon.png'),
            autoHideMenuBar: true,
            webPreferences: {
                devTools: DEV_TOOLS === 'true',
                nodeIntegration: true,
                contextIsolation: false,
                nativeWindowOpen: true,
                preload: path.resolve(__dirname, 'build', 'preload.js')
            }
        });
        //Set default menu to a new menu
        Menu.setApplicationMenu(createMenu());
        //Check if devTools should be enabled
        if (DEV_TOOLS === 'true') {
            win.webContents.openDevTools({mode: 'detach'});
        }
        //Load file to display
        win.loadFile(path.resolve(__dirname, 'dist', 'index.html'));
    }
};
const checkUpdates = () => {
    //First, must be enabled
    if (configs.checkUpdates) {
        //Create octokit
        const octo = new Octokit({auth: GITHUB_KEY});
        //Asking for latest release
        octo.request(
            'GET /repos/{owner}/{repo}/releases/latest',
            {
                owner: GITHUB_USER,
                repo: name
            }
        ).then(res => {
            //If tags mismatches...
            if (!res.data.tag_name.includes(version)) {
                //...ask user what to do
                const answer = dialogs.ask(
                    trans.newerRelease.title,
                    format(trans.newerRelease.message, res.data.tag_name),
                    'question'
                );
                //If answer yes...
                if (answer === 1) {
                    //...send to website
                    shell.openExternal(res.data.html_url)
                        .then(() => app.exit())
                        .catch(err => dialogs.error(err.message));
                } else if (answer === 0) {
                    //If answer dontAskAgain, disable future updates check
                    configs.checkUpdates = false;
                }
            }
        }).catch(err => console.error(err.message));
    }
};
const loadConfigs = () => {
    //Checking configs directory existence
    if (!fs.existsSync(configsDir)) {
        //Creating if not exists
        fs.mkdirSync(configsDir, {recursive: true});
    }
    //Checking configs file existence
    if (fs.existsSync(configsFile)) {
        //Parsing and assign to current configs if exists
        Object.assign(configs, require(configsFile));
    }
};
const saveConfigs = () => {
    fs.writeFileSync(configsFile, JSON.stringify(configs), {flag: 'w'});
};
const loadTrans = () => {
    const lang = (configs.lang || process.env.LANG || 'en_US.UTF-8').match(/([a-z]{2})/)[0];
    const file = path.resolve(configsDir, `${lang}.${ext.lang}`);
    if (fs.existsSync(file)) {
        Object.assign(trans, require(file));
    }
};
const loadFileFilters = () => {
    fileFilters.input.push({
        name: trans.file.filter.any,
        extensions: Object.values(ext.input),
    }, ...Object.keys(ext.input).map(key => {
        return {name: format(trans.file.filter[key], ext.input[key]), extensions: [ext.input[key]]};
    }));
    fileFilters.output.push(...Object.keys(ext.output).map(key => {
        return {name: format(trans.file.filter[key], ext.output[key]), extensions: [ext.output[key]]};
    }));
};
const importFiles = (...files) => {
    let count = 0;
    progress();
    files.forEach((file, index) => {
        const dest = path.resolve(configsDir, path.basename(file));
        let canCopy = (!configs.skipOnExists || !fs.existsSync(dest));
        if (!canCopy && configs.askOnExists) {
            const action = dialogs.ask(
                trans.file.import.title,
                format(trans.file.import.ask, dest),
                'manage'
            );
            canCopy = (action < 2);
            configs.askOnExists = (action === 0);
            configs.skipOnExists = (action === 3);
        }
        if (canCopy) {
            try {
                fs.accessSync(file);
                fs.copyFileSync(file, dest);
                count++;
            } catch (e) {
                dialogs.error(format(trans.errors.notAccessible, file), trans.file.import.title);
            }
        }
        progress((index + 1) * 100 / files.length);
    });
    if (count > 0) {
        dialogs.ask(trans.file.import.title, format(trans.file.import.message, count), 'info');
    }
};
const exportFile = (to = '', param = 'en', wantsLang = true) => {
    wantsLang = wantsLang || typeof wantsLang === 'undefined';
    to = to || '';
    let res = {
        success: false,
        error: false,
    };
    if (wantsLang) {
        param = param || 'en';
        const langFile = path.resolve(configsDir, `${param}.${ext.output.lang}`);
        res.error = !((param === 'en' || fs.existsSync(langFile)) && to.length > 0);
        if (!res.error) {
            try {
                fs.accessSync(path.dirname(to), fs.constants.W_OK);
                if (param === 'en') {
                    fs.writeFileSync(to, JSON.stringify(transBkp), {flag: 'w'});
                } else {
                    fs.copyFileSync(langFile, to);
                }
                res.success = true;
            } catch (e) {
                res.success = false;
            }
        }
    } else if (typeof param === 'string') {
        const connFile = path.resolve(configsDir, `${param}.${ext.output.conn}`);
        res.error = !(fs.existsSync(connFile) && to.length > 0);
        if (!res.error) {
            try {
                fs.accessSync(path.dirname(to), fs.constants.W_OK);
                fs.copyFileSync(connFile, to);
                res.success = true;
            } catch (e) {
                res.success = false;
            }
        }
    }
    return res;
};
const closeDb = async () => {
    if (typeof db !== 'undefined') {
        await db.then(conn => {
            conn.end();
            db = undefined;
        });
    }
    await void (0);
}


// Events related
app.on('ready', () => {
    loadConfigs();
    loadTrans();
    loadFileFilters();
    checkUpdates();
    createWindow();
});

app.on('window-all-closed', () => {
    saveConfigs();
    closeDb().then(() => {
        //If app is not running on Mac...
        if (process.platform !== 'darwin') {
            //...exit app
            app.exit();
        }
    });
});

app.on('before-quit', () => {
    closeDb().then(() => void (0));
});

app.on('activate', () => {
    //If there aren't app windows opened...
    if (BrowserWindow.getAllWindows().length === 0) {
        //...create a new window
        createWindow();
    }
});

cli.on('close', () => app.exit());

ipcMain.on('app:trans', (e) => {
    e.returnValue = Object.assign({}, trans);
});

ipcMain.on('db:connect', (e, user, password, host = '127.0.0.1', port = 3306) => {
    progress();
    closeDb().then(() => {
        db = createConnection({
            host,
            user,
            password,
            port,
            rowsAsArray: true,
        });
        progress(50);
        db.then(conn => {
            conn.on('error', (e) => dialogs.error(e.message, e.errno.toString()));
            progress(100);
            e.returnValue = true;
        }).catch(err => {
            dialogs.error(err.message);
            e.returnValue = false;
        });
    });
});

ipcMain.on('db:execute', (e, query, ...params) => {
    progress();
    db.then(conn => {
        progress(10);
        conn.query(query, params)
            .then(rows => {
                progress(100);
                e.returnValue = rows;
            })
            .catch(err => {
                progress();
                dialogs.error(err.message);
                e.returnValue = [];
            });
    });
});

ipcMain.on('file:export', (e) => {
    //Show system save dialog
    let res = dialogs.open(
        trans.file.export.title,
        configsDir,
        fileFilters.output
    );
    //If confirmed...
    if (typeof res !== 'undefined') {
        res.forEach(file => {
            //Export file and return value
            e.returnValue = exportFile(
                file,
                file.replace(anyExt, ''),
                file.endsWith(ext.output.lang)
            );
        });
    } else {
        //Otherwise, return false
        e.returnValue = {
            success: false,
            error: false,
        };
    }
});

ipcMain.on('file:import', (e, ...params) => {
    //Show system open dialog
    const res = dialogs.open(trans.file.import.title);
    //If confirmed...
    if (typeof res !== 'undefined') {
        //...import files
        importFiles(...res);
    }
});

ipcMain.on('file:read', (e, file = '') => {
    let res = {};
    if (file && file.length > 0) {
        const confFile = path.resolve(configsDir, file);
        const supported = Object.values(ext)
            .map(e => confFile.endsWith(e))
            .reduce((prev, next) => prev || next);
        if (fs.existsSync(confFile) && supported) {
            res = require(confFile);
        }
    }
    e.returnValue = res;
});

ipcMain.on('file:write', (e, content, which = 'any') => {
    let allowedExt = Object.values(ext.input);
    if (which !== 'any' && allowedExt.includes(which)) {
        allowedExt = allowedExt.filter(ae => ae === which);
    }
    const filters = fileFilters.input.filter(
        ff => allowedExt
            .map(ae => ff.extensions.includes(ae))
            .reduce((prev, next) => prev || next)
    );
    const res = dialogs.save(trans.file.write.title, null, filters);
    let ret = false;
    if (typeof res === 'string') {
        try {
            fs.accessSync(path.dirname(res), fs.constants.W_OK);
            const fileExt = res.match(anyExt)[0];
            const extKey = Object.entries(ext.input).filter(entry => entry[1] === fileExt).map(entry => entry[0])[0];
            fs.writeFileSync(res.replace(fileExt, ext.output[extKey]), content);
            ret = true;
        } catch (e) {
            dialogs.error(format(trans.errors.notAccessible, res), trans.file.write.title);
        }
    }
    e.returnValue = ret;
});