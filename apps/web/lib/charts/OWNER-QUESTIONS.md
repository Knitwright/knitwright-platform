# Owner questions: size chart import (step 25)

Nothing here blocks the import. Each answer may change a rule in `lib/charts`.

1. **Which points must a brand's chart have?** Now: every point every garment of the type
   has. A jersey chart may leave out shoulder width, collar height and the placket, because
   some jerseys have none. Should those be required too?
2. **Tolerance.** A chart must give a tolerance above zero for every point, from a column
   in the file. Brands without tolerances cannot import. Should a missing tolerance be
   allowed and shown as "to be confirmed"?
3. **Units.** Only centimetres are read. Do brands send inches? **Answered 2026-09-30: accept
   centimetres and inches.** Built: the unit is chosen on the mapping screen or read row by row
   from a units column (cm or in; an empty cell uses the screen's choice); inches may be decimals
   or fractions to a sixty-fourth; the chart is stored in centimetres, to the nearest tenth of a
   millimetre; any other unit (mm, ft) is refused with the line named (`lib/charts/units.ts`).
4. **Source name.** The person importing types who produced the numbers; the date is the
   day of import. Is the importer's own account name enough?
5. **Removing a chart.** A chart can be replaced but not removed, and no history of charts
   is kept beyond the stored files. Is that enough for the beta?
6. **Brand chart over platform chart.** A brand's chart for a wearer and garment replaces
   every platform chart for them, whatever the fit. Agreed? **Answered 2026-09-30: yes, as
   built.**
