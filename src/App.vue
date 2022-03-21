<template>
  <header></header>
  <RouterView/>
  <footer>
    <progress id="progress" :max="100" :value="progress"></progress>
  </footer>
</template>

<script>
export default {
  name: 'App',
  data: () => {
    return {
      options: [],
      progress: 0,
      trans: {}
    };
  },
  components: {},
  mounted() {
    window.ipcRenderer.on('progress:change', (e, value) => {
      this.progress = value;
    });
    this.trans = window.ipcRenderer.sendSync('app:trans');
  }
}
</script>

<style>
@media (prefers-color-scheme: light) {
  :root {
    --mdbg-active: #fac733;
    --mdbg-background: #fafafa;
    --mdbg-border: .2rem solid;
    --mdbg-color: #333333;
  }
}

@media (prefers-color-scheme: dark) {
  :root {
    --mdbg-active: #3333fa;
    --mdbg-background: #333333;
    --mdbg-border: .2rem solid;
    --mdbg-color: #fafafa;
  }
}

* {
  font-family: Ubuntu, sans-serif;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  text-decoration: none;
  outline: none;
}

html, body, #app {
  width: 100vw;
  height: 100vh;
  background-color: var(--mdbg-background);
  color: var(--mdbg-color);
}

button {
  background-color: var(--mdbg-background);
  color: var(--mdbg-color);
  border: var(--mdbg-border) var(--mdbg-color);
}

#app {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

footer {
  display: flex;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
}

#progress {
  width: 100%;
}
</style>
