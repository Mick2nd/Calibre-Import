
function calibre_import_dir(...obj)
{
	console['calibre_import_dir'](obj);
}

console['calibre_import_dir'] = console.dir;
console.dir = calibre_import_dir;

exports = { };
