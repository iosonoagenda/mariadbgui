<template>
  <div>
    <div class="db">
      <OptionsComponent :key="optionsKey"
                        :options="$root.trans.actions.connection"
                        :visibility="optionsVisibility"
                        @action="action"/>
    </div>
    <ul class="fields">
      <li v-for="(value, key) in conn" :key="key" class="field">
        <input v-if="editable"
               v-model="conn[key]"
               :placeholder="$root.trans.inputs.connection[key]"
               :type="key !== 'password' ? (typeof value).replace('string', 'text') : 'password'">
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
      optionsKey: 0,
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
        this.optionsKey++;
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
  computed: {
    optionsVisibility() {
      const res = {};
      Object.keys(this.$root.trans.actions.connection).forEach(key => {
        res[key] = (key !== 'save' ? !this.editable : this.editable);
      });
      return res;
    }
  },
  mounted() {
    this.editable = (this.file.length === 0);
    this.optionsKey++;
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