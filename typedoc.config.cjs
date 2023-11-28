/** @type {import('typedoc').TypeDocOptions} */
module.exports = {
	"$schema": "https://typedoc.org/schema.json",
	"entryPoints": ["src", "assets", "README.md"],
	"entryPointStrategy": "expand",
	"out": "docs",
	"cleanOutputDir": true,
	
	"name": "Calibre Import",
	"theme": "default", 
	"basePath": ".",
	"skipErrorChecking": () => true,
    "plugin": ["typedoc-umlclass"],
    "umlClassDiagram": 
    {
        "type": "detailed",
        "location": "local",
        "format": "svg"
    }
};
