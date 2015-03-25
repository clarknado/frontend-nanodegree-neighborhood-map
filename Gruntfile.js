module.exports = function(grunt) {

	require("matchdep").filterDev("grunt-*").forEach(grunt.loadNpmTasks);

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		htmlhint: {
			build: {
				options: {
					'tag-pair' : true,
					'tagname-lowercase' : true,
					'attr-lowercase' : true,
					'attr-value-double-quotes' : true,
					'doctype-first' : true,
					'spec-char-escape' : true,
					'id-unique' : true,
					'head-script-disabled' : true,
					'style-disabled' : true,
					'img-alt-require' : true,

				},
				src : ['index.html']
			}
		},
		uglify: {
			build: {
				files: [ {
					expand: true,
					cwd: 'assets',
					src: '**/*.js',
					ext: '.js',
					extDot: 'first',
					dest: 'build'
				}]
			}
		},
		jshint: {
			build: {
				files: [ {
					expand: true,
					cwd: 'assets',
					src: '**/*.js',
				}]
			}
		},
		imagemin: {
			build: {
				options: {
					optimizationLevel: 3
				},
				files: [{
					expand: true,
					cwd: 'assets',
					src: '**/*.{png,jpg}',
					dest: 'build'
				}]
			}
		},
		cssc: {
			build: {
				options: {
					consolidateViaDeclarations: true,
					consolidateViaSelectors: true,
					consolidateMediaQueries: true
				},
				files: [ {
					expand: true,
					cwd: 'build',
					src: '**/*.css',
					dest: 'build'
				} ]
			}
		},
		cssmin: {
			build: {
				files: [ {
					expand: true,
					cwd: 'build',
					src: '**/*.css',
					dest: 'build'
				} ]
			}
		},
		sass: {
			build: {
				files: [ {
					expand: true,
					cwd: 'assets/sass',
					src: '**/*.scss',
					ext: '.css',
					extDot: 'first',
					dest: 'build/css'
				} ]
			}
		},
		watch: {
			html: {
				files: ['index.html'],
				tasks: ['htmlhint']
			},
			js: {
				files: ['assets/**/*.js'],
				tasks: ['buildjs']
			},
			css: {
				files: ['assets/**/*.scss'],
				tasks: ['buildcss']
			}
		}
	});

	grunt.registerTask('default', ['buildjs', 'buildcss', 'buildhtml']);
	grunt.registerTask('buildcss', ['sass', 'cssc', 'cssmin']);
	grunt.registerTask('buildjs', ['jshint', 'uglify']);
	grunt.registerTask('buildhtml', ['htmlhint']);
};