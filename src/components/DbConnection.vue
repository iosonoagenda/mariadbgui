<template>
  <div>
    <div class="db">
      <OptionsComponent :options="$root.trans.actions.connection" @action="action"></OptionsComponent>
    </div>
    <ul class="fields">
      <li v-for="(value, key) in conn" :key="key" class="field">
        <input v-if="editable" v-model="conn[key]" :type="(typeof value).replace('string', 'text')">
        <span v-if="!editable">{{ value }}</span>
      </li>
    </ul>
  </div>
</template>

<script>
import OptionsComponent from "@/components/OptionsComponent";

export default {
  name: "DbConnection",
  components: {OptionsComponent},
  props: {
    file: {
      type: String,
      required: true
    }
  },
  data: () => {
    return {
      editable: false,
      conn: {
        user: '',
        password: '',
        host: '127.0.0.1',
        port: 3306
      }
    };
  },
  methods: {
    action(which) {
      if (typeof this[which] === 'function') {
        this[which]();
      }
    },
    connect() {
      const status = window.ipcRenderer.sendSync('db:connect', ...this.conn);
      if (status) {
        this.$router.push('/manage');
      }
    },
    edit() {
      this.editable = !this.editable;
    },
    save() {
      const file = window.ipcRenderer.sendSync('file:write', JSON.stringify(this.conn));
      if (file && file.length > 0) {
        this.$emit('saved', file);
      }
    }
  },
  mounted() {
    this.editable = (this.file.length === 0);
    if (!this.editable) {
      this.conn = window.ipcRenderer.sendSync('file:read', this.file);
    }
  }
}
</script>

<style scoped>
ul {
  list-style: none;
}
</style>