/**
 * @abstract A console.dir override for Scripts.
 * 			 It permitts the output of more than 1 object in an array.
 */
function calibre_import_dir(...obj)
{
	console['calibre_import_dir'](obj);
}

console['calibre_import_dir'] = console.dir;
console.dir = calibre_import_dir;

/**
 * @abstract Error fix for scripts developed as TS (typescript).
 */
exports = { };
