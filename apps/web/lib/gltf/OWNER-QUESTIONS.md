# glTF base models: what is owed by the owner

- **The artist models.** There are none. The viewer and `validateModel` are ready for them; until they exist the only model
  is the placeholder, labelled "placeholder, not an artist model". For each article the artist needs the panel layout
  (`buildPanelLayout`) and a model whose nodes are named for the panels, whose UV islands match it (run `validateModel`),
  centred on each node's origin, with one material for the body, one for the sleeves and one for the collar.
- **The swatch book.** Fabric and trim looks (sheen, knit relief, shine of a print) are material settings the artist or the
  owner chooses. The placeholder uses plain colours and says nothing about a real fabric. A swatch book of the fabrics the
  factory uses would let the materials be set from something real.
- **Which sizes get a model.** One model per article is graded to the other sizes by scaling each panel (`gradeModel`).
  Is that enough for XS to 3XL, or does a size need its own model?
- **How exact is exact.** Islands must be within half a pixel of the 2048 picture (about 0.00024 in UV). Tighter or looser?
- **Where the viewer lives.** `ModelViewer` is built but the editor still opens the older form (`Preview3D` is unchanged).
  Switch it over once the first artist model exists?
