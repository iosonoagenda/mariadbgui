<template>
  <div class="options">
    <button v-for="(value, key) in options" :key="key" type="button" @click="action(key)">
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
    }
  },
  methods: {
    action(which) {
      this.$emit('action', which);
    }
  }
}
</script>

<style scoped>

</style>