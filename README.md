# Calibre Import Joplin Plugin

This is a Joplin plugin.

## Two Plugins in One Package

There are two plugins in this package. 

The first one is the Calibre Import plugin. It is able to import a Calibre Library database into
Joplin. 

The second one is the Attributes Content plugin. It intercepts the Markdown-it token stream and detects embedded Attribute
definitions. Those are used to equip the next HTML element with attributes. This second plugin is used by the first one to implement
a Html to Markdown translation.

## The Calibre Import

After the installation you can import Calibre Library metadata into Joplin. The imported data include the title, the authors, the
cover (if one exists), links to the existent book formats, the comments section and an additional content section (custom field).
The data are imported into the selected Joplin sub folder, taking into account the book genres, a hierarchical arranged custom
field.

All working can be controlled by a set of settings in the *Calibre Import* settings page, the most of which can be used as is for 
first trials.

### The General Processing Order

To import the data of a library, follow these steps:

1. Look at the *configuration settings* and change them if you decide to do so. Overtake these settings to make them active.
2. Select the *sub folder* where to import the Calibre metadata
3. Invoke the *import command* and select a Calibre Library folder, then choose okay
4. The processing begins. After a short delay the data should be present and you can examine the results

### Possibilities for Configuration 

A list of configuration settings follows (incomplete):

1. The used genre field
2. The used content field (can be left empty)
3. A filter for book titles. This can be *SQL LIKE* expression
4. A filter for genres. This again can be *SQL LIKE* expression
5. The cover height, used in a *style* section
6. The *Merge Mode* controls how conflicts between existing and new content are solved
7. The *Cleanup Mode* controls cleanup behavior after the import is complete. This defaults to deletion of the content not present in the input

### Sample Screen Shots of Generated Notes

The images are partly in German.

The following is a generated Genre tree.

![A generated genre tree](./assets/media/Genre%20Tree.png)

It follows a generated Note, one version with Spoilers collapsed, the other version with expanded Spoilers.

![A generated note, spoilers expanded](./assets/media/Rendered%20MD,%20Spoilers%20Collapsed.png)

Spoilers expanded:

![A generated note](./assets/media/Rendered%20MD,%20Spoilers%20Expanded.png)


## The Embedded *Attributes* Plug-in

### For What it was Meant

Primarily this content plug-in is to be used by the *Calibre Import*. The import translates *Html* into *MD*
for consistency reasons. The Html can contain lists with attributes. That's why sometimes attributes are
required to give a compatible view.

### For What it can be Used

You can equip the following MD constructs with attributes:

<a name="scope"></a>

1. Lists (level 1 and embedded lists, ordered and unordered and task lists)
1. Paragraphs
1. Block quotes
1. Headings
1. Tables
1. Horizontal Rulers
1. Code Fences. The surrounding `<span>` tag is equipped with attributes.
1. Images and Links. The surrounding `<p>` tag (paragraph) is equipped with attributes.
   To equip a link with styles, you can, for instance, use the following construct:

   ```text
   ///attributes:id=link
   [Web](https://google.com)
   ...
   #link a { background-color: yellow; }
   ```

What can be done:

1. Equip the generated Html with class names or ids and use those in style definitions
1. Continue ordered lists with the start attribute
1. Make the bullets of lists disappear (*list-style-type: none*)
1. Generally all attributes for the Html tag in question are possible

### Samples

The following MD suppresses bullets in the succeeding list, then a list with start number 10 follows:

```text
///attributes:style=list-style-type:none
1. Item 1
2. Item 2

///attributes:start=10
1. Item 1
2. Item 2
```

This gives us the following view:

![Generated view of lists](./assets/media/Lists%20with%20Attributes.png)

## Release Notes

### 1.0.3

The scope of the *attributes* content plug-in was extended by ([see above](#scope)):

* headings
* tables
* horizontal rulers
* code fences
* images and links

### 1.0.2

* Added tags to the imported data

### 1.0.1

* Error handling was improved
* Documentation was improved
* Added *typedoc* to the project including class diagrams
* Bug fix: interference with other plug-ins, for instance *Code Section*
* Bug fix: notes could not be exported to PDF after installing the plug-in

### 1.0.0

* The first release
