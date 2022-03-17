const {defineConfig} = require('@vue/cli-service')
const path = require('path');
module.exports = defineConfig({
    publicPath: process.env.NODE_ENV === 'production' ? './' : '/',
    pluginOptions: {
        electronBuilder: {
            preload: path.resolve(__dirname, 'build', 'preload.js')
        }
    },
    transpileDependencies: true
})
