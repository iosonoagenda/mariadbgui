<template>
  <div class="options">
    <button v-for="(value, key) in filteredOptions" :key="key" type="button" @click="action(key)">
      {{ value }}
    </button>
  </div>
</template>

<script>
export default {
  name: "OptionsComponent",
  props: {
    options: {
      type: Object,
      required: true
    },
    visibility: {
      type: Object,
      default: () => {
        return {};
      }
    }
  },
  methods: {
    action(which) {
      this.$emit('action', which);
    }
  },
  computed: {
    filteredOptions() {
      const res = {};
      console.log('visibility:', this.visibility);
      Object.entries(this.options)
          .filter(entry => typeof this.visibility[entry[0]] === 'undefined' || this.visibility[entry[0]])
          .forEach(entry => {
            res[entry[0]] = entry[1];
          });
      console.log('res:', res);
      return res;
    }
  }
}
</script>

<style scoped>

</style>