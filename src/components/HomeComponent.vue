<template>
  <div>
    <h1>Welcome to MariaDB GUI!</h1>
    <OptionsComponent :options="$root.trans.actions.home" @action="action"></OptionsComponent>
    <DbConnection v-for="db in dbs" :key="db" :file="db"></DbConnection>
  </div>
</template>

<script>
import DbConnection from "@/components/DbConnection";
import OptionsComponent from "@/components/OptionsComponent";

export default {
  name: "HomeComponent",
  components: {DbConnection, OptionsComponent},
  data: () => {
    return {
      dbs: []
    };
  },
  methods: {
    action(which) {
      if (typeof this[which] === 'function') {
        this[which]();
      }
    },
    create() {
      if (!this.dbs.includes('')) {
        this.dbs.push('');
      }
    }
  }
}
</script>

<style scoped>

</style>