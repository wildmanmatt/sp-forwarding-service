'use strict';

module.exports = function(grunt) {

  require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

  grunt.initConfig({

    jshint: {
      files: [
        '*.js'
      ],
      options: {
        jshintrc: '.jshintrc'
      }
    },

    jscs: {
      src: '*.js'
    }
  });

  grunt.registerTask('default', ['jshint', 'jscs']);
};
