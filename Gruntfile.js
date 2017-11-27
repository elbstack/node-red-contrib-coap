module.exports = function gruntConfig(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    simplemocha: {
      options: {
        globals: ['expect'],
        ignoreLeaks: false,
        ui: 'bdd',
        reporter: 'spec',
      },
      all: { src: ['test/**/*_spec.js'] },
    },
  });

  grunt.loadNpmTasks('grunt-simple-mocha');
  grunt.loadNpmTasks('grunt-contrib-jshint');

  grunt.registerTask('default', ['simplemocha:all']);
};
