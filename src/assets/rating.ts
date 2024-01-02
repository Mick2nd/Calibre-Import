
/**
 * @abstract This function equips HTML elements of class 'calibre-rating' with svg content painting
 * 			 desired rating stars
 */
export default function equip_calibre_rating()
{
	addEventListener("error", (event) => { });

	const div = document.getElementById('calibre-rating-assets');
	if (!div) return;
	
	const cache = div.attributes['custom'].value.trim();
	if (cache === '') return;
	
	let containers = document.getElementsByClassName("calibre-rating");
	let rating = 0;

	for (let container of containers)
	{
		if (container.attributes['rating'] !== undefined)
		{
			rating = container.attributes['rating'].value;
		}
		const svgref = `${cache}/assets/rating.svg?rating=scale(${rating} 1)`
		const obj = `<object type="image/svg+xml" data="${svgref}" style="width:inherit; height:inherit; display:inline;" />`
		try 
		{ 
			container.innerHTML = obj; 
		} 
		catch(e) 
		{ 
			console.error(e);
			window.alert('Script executed');		
		}
	}
}

equip_calibre_rating();
	
/**
 * @abstract This invocation guaranties refresh of the SVG content after the html page is redrawn
 */
setInterval(() => 
{ 
	let containers = document.getElementsByClassName("calibre-rating");
	if (containers[0] !== undefined && containers[0].children.length == 0) equip_calibre_rating(); 
}, 50);
