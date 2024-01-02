
/**
 * @abstract Interface for Joplin instance methods
 * 			 Purpose is to simplify the interface between "Calibre" and "Tree" instances
 */
export interface IEvents
{
	onStart(library_path: string) : Promise<void>;
	onBook(level: number, genre: string, id: number) : Promise<void>;
	onNote(library_path: string, book: any) : Promise<void>;
	onIncrease() : void;
	onDecrease() : void;
	onStop() : void;
}
