

/**
 * @abstract A standard way to apply Mixins
 * 
 */
function applyMixins(derivedCtor: any, constructors: any[])
{
	constructors.forEach((baseCtor) => 
	{
		Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => 
		{
			Object.defineProperty(
				derivedCtor.prototype,
				name,
				Object.getOwnPropertyDescriptor(baseCtor.prototype, name) || Object.create(null)
			);
		});
	});
}

function mixinFunction(ctor: any, f: Function)
{
	Object.defineProperty(ctor.prototype, f.name, f);
}

/**
 * @abstract Provides a generator for a "slice" of an array
 * 
 */
function* lazy<T>(iterable: [T], start: number, end: number) : any
{
	for (let idx = start; idx < end; idx++)
	{
		yield iterable[idx];
	}
}
