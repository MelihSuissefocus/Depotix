{
    'name': 'Depotix Branding',
    'version': '1.0',
    'category': 'Customization',
    'depends': ['web'],
    'data': ['views/branding.xml'],
    'assets': {
        'web.assets_backend': [
            'depotix_branding/static/src/css/hide_modules.css',
            'depotix_branding/static/src/js/hide_modules.js',
        ],
    },
    'installable': True,
    'auto_install': False,
}
