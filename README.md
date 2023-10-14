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

![A generated genre tree](./doc/Genre%20Tree.png)

It follows a generated Note, one version with Spoilers collapsed, the other version with expanded Spoilers.

![A generated note, spoilers expanded](./doc/Rendered%20MD,%20Spoilers%20Collapsed.png)

Spoilers expanded:

![A generated note](./doc/Rendered%20MD,%20Spoilers%20Expanded.png)
 