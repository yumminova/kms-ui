
require.config({
	waitSeconds: 200,
	paths: {
		'async': 'js/lib/async',
		'bootstrap': 'js/lib/bootstrap-2.3.1.min',
		'bootstrap-clickover': 'js/lib/bootstrapx-clickover-1.0',
		'chart': 'js/lib/chart.min',
		'card': 'js/lib/card',
		'chosen': 'js/lib/jquery.chosen.min',
		'chosenImage': 'js/lib/jquery.chosenImage',
		'crossroads': 'js/lib/crossroads.min',
		'config': 'js/config',
		'datatables': 'js/lib/tables/jquery.dataTables-1.8',
		'dependClass': 'js/lib/jquery.dependClass',
		'ddslick': 'js/lib/jquery.ddslick.min',
		'fileupload': 'js/lib/jquery.fileupload',
		'footable': 'js/lib/footable/footable.min',
		'footable-filter': 'js/lib/footable/footable.filter.min',
		'footable-sort': 'js/lib/footable/footable.sort.min',
		'form2object': 'js/lib/form2object',
		'handlebars': 'js/lib/handlebars-v4.0.5',
		'hasher': 'js/lib/hasher.min',
		'hotkeys': 'js/lib/jquery.hotkeys.min',
		'introJs': 'js/lib/intro.min',
		'isotope': 'js/lib/jquery.isotope.min',
		'jquery': 'js/lib/jquery-1.9.1.min',
		'jqueryui': 'js/lib/jquery-ui-1.10.3.custom.min',
		'jstz': 'js/lib/jstz.min',
		'kazoosdk': 'js/lib/jquery.kazoosdk',
		'mask': 'js/lib/jquery.mask',
		'monster': 'js/lib/monster',
		'monster-ui': 'js/lib/monster.ui',
		'monster-timezone': 'js/lib/monster.timezone',
		'monster-language': 'js/lib/monster.language',
		'monster-quickcalldevice': 'js/lib/monster.quickcalldevice',
		'monster-ttsvoice': 'js/lib/monster.ttsvoice',
		'monster-routing': 'js/lib/monster.routing',
		'monster-util': 'js/lib/monster.util',
		'nicescroll': 'js/lib/jquery.nicescroll.min',
		'monster-apps': 'js/lib/monster.apps',
		'monster-regiodialplan': 'js/lib/monster.regiodialplan',
		'monster-flags': 'js/lib/monster.flags',
                'plugins': 'js/plugins',
                'postal': 'js/lib/postal-0.8.2',
                'prettify':'js/lib/prettify',
                'renderjson': 'js/lib/renderjson',
                'reqwest': 'js/lib/reqwest-0.7.3.min',
                'signals': 'js/lib/signals.min',
                'slider': 'js/lib/jquery.slider',
                'socket': 'js/lib/socket.io.min',
                'timepicker': 'js/lib/jquery.timepicker.min',
                'toastr': 'js/lib/toastr-1.3.0',
                'touch-punch': 'js/lib/jquery.ui.touch-punch.min',
                'underscore': 'js/lib/underscore.min',
                'validate': 'js/lib/jquery.validate.min',
                'vkbeautify':'js/lib/vkbeautify',
                'wysiwyg': 'js/lib/bootstrap.wysiwyg.min'
	},
	shim: {
		'footable-sort': ['footable'],
		'footable-filter': ['footable'],
		'bootstrap': ['jqueryui'],
		'bootstrap-clickover': ['bootstrap'],
		'datatables': ['jquery'],
		'jqueryui': ['jquery'],
		'handlebars': {
			'exports': 'Handlebars'
		},
		'crossroads': ['signals'],
		'hasher': ['signals'],
		'slider': ['dependClass'],
		'plugins': ['jquery'],
		'kazoosdk': ['jquery'],
		'touch-punch': ['jqueryui'],
		'underscore': {
			'exports': '_'
		}
	},
	urlArgs: 'bust=' + (new Date()).getTime()
});

require(['jquery', 'monster', 'plugins', 'bootstrap', 'bootstrap-clickover', 'touch-punch'], function($, monster){
	$.support.cors = true;

	monster.initSDK();

	require(['monster-util', 'monster-ui', 'monster-apps', 'monster-routing', 'socket'], function(util, ui, apps, routing, socket){
		monster.util = util;
		monster.ui = ui;
		monster.apps = apps;
		monster.routing = routing;

		monster.util.setDefaultLanguage();

		if('socket' in monster.config.api) {
			monster.socket = io.connect(monster.config.api.socket);
		}

		monster.apps.load('core', function(app){
			app.render($('#main'));
		});
	});
});
