# Garment registry: questions for the owner

Everything here is provisional until the owner confirms it. Each line gives the
question, then what the code does today. Changing any answer is a data edit in
`registry/tops/`, not a code change.

## Impossible combinations

- Is a polo collar without a placket truly impossible? Today it is refused. Some soccer jerseys have a folded V collar with no placket, so a V neck with a polo collar is effectively blocked.
- Is a band collar on a V neck truly impossible? Today it is refused.
- Is a placket on a V neck truly impossible? Today it is refused.
- Are there other combinations that cannot be made? Today only the three above are refused. Rib cuffs on short sleeves, side vents with side panels, and a henley (round neck, placket, no collar) are all allowed.

## Which types offer which choices

- Should raglan sleeves be offered on more than the team jersey? Baseball style raglan tees and long sleeve tees are common. Today only the team jersey offers raglan.
- Should the plain tees offer a placket, cuffs or side panels? Today the crew tee and V neck tee offer none of these, and the long sleeve tee offers cuffs only.
- Should the polo offer a "no placket" choice? Today it is offered, and picking it is refused because of the polo collar rule.
- Should the team jersey offer a polo collar? Today it offers no collar or a band collar only.

## Choices I made up

- Fit choices: regular, slim, relaxed.
- Hem shapes: straight, curved (longer at the back), and straight with a small split at each side.
- Collars: none, polo collar, band collar.
- Placket types: none, buttons, zip.
- Artwork anchors: centre chest, left chest, right chest, lower front (front); upper back, centre back, lower back (back); middle of the sleeve. Only body and sleeve panels can carry artwork.
- Panels that can be coloured: body front, body back, left sleeve, right sleeve, neckband, collar, placket, side panels, cuffs. Is that the right list for a factory?

## Artwork and measurements

- May artwork be placed on collars, cuffs and plackets? Today only body and sleeve panels have places to put it, so artwork on the others is refused.
- Do cuffs and neckbands need their own measurements, such as cuff height and neckband height? Today they have none.
- Is 2048 pixels on the longest side enough for sublimation artwork? The upload limit is set in the file storage layer, not here.

## Fabric and provenance

- Fabric is now a list, and each panel can name its fabric. Panels with no entry use the first fabric. Is one fabric per panel enough, or does a panel ever need two?
- Each fabric carries where its details came from, as one of the six provenance words. Is that the right level, or should each field (composition, weight and so on) carry its own?
- A measurement may be marked "derived". Step 5 decides when that is used.

## How to measure sentences a factory should check

Each sentence is a plain draft. These need a factory's eye most:

- Armhole: "from the top of the armhole seam, where the sleeve meets the shoulder, down to the underarm point where the sleeve meets the side seam." Factories differ on straight or curved armhole measures.
- Upper arm: "straight across the sleeve just below the underarm, at a right angle to the length of the sleeve." Factories often say how far below the underarm.
- Front neck drop and back neck drop: measured down from a ruler laid shoulder seam to shoulder seam. Some factories measure from the shoulder point instead.
- Sleeve length: "from the shoulder seam where the sleeve is joined, or from the neck edge on a raglan, to the edge of the sleeve opening." Raglan sleeve length is measured in different ways.
- Body length: "from the highest point of the shoulder, where it meets the neckline, straight down to the bottom edge of the hem." Confirm the start point.
- Chest width: "just below where the sleeve joins the body." Factories usually give a set distance below the armhole.
- Collar height: measured at the centre back, from the seam to the top edge. Confirm for folded polo collars.
- Placket length and width: length to the end of the stitching, width about halfway down. Confirm.
- Hem width and sleeve opening: "without stretching it." Confirm whether ribbed hems and cuffs are measured relaxed or stretched.

## Construction rules (added in step 8): a factory must confirm every one

These are a STARTING PROPOSAL from general knitwear practice. They are not a factory's method.
Each rule names a seam class (ISO 4916) and a stitch class (ISO 4915). These are the names of
kinds of seam and stitch, not quantities. A design shows each as "worked out from other values"
until the user changes it, and then as typed in by the user. The rules are data in
`registry/tops/construction.ts`, and the names and explanations are in
`registry/construction-classes.ts`. Changing an answer is a data edit.

| Seam | Joins | When | Seam class | Stitch class |
|---|---|---|---|---|
| Shoulder seam | body front, body back | set-in sleeve | 1 superimposed | 514 four thread overedge |
| Raglan seam | body front, body back, both sleeves | raglan sleeve | 1 superimposed | 514 four thread overedge |
| Armhole seam | both sleeves, body front, body back | set-in sleeve | 1 superimposed | 514 four thread overedge |
| Sleeve underarm seam | both sleeves | always | 1 superimposed | 514 four thread overedge |
| Side seam | body front, body back | no side panels | 1 superimposed | 514 four thread overedge |
| Side panel seam | body front, body back, side panels | contrast strips | 1 superimposed | 514 four thread overedge |
| Sleeve hem | both sleeves | no ribbed cuffs | 6 edge finish | 602 two needle cover stitch |
| Cuff seam | both sleeves, cuffs | ribbed cuffs | 1 superimposed | 514 four thread overedge |
| Body hem | body front, body back | always | 6 edge finish | 602 two needle cover stitch |
| Side vent finish | body front, body back | side vents | 6 edge finish | 301 lockstitch |
| Neckband seam | neckband, body front, body back | no collar | 1 superimposed | 514 four thread overedge |
| Collar seam | collar, body front, body back | polo or band collar | 1 superimposed | 514 four thread overedge |
| Placket seam | placket, body front | buttons or zip | 2 lapped | 301 lockstitch |
| Zip seam | placket | zip | 2 lapped | 301 lockstitch |

- Are these the right seam classes and stitch classes for knitted tops? In particular: is 514 right for every joining seam, or do some factories use 504 or 401? Are hems 602, or 406 or 605?
- The catalogue also offers 401 double chain stitch, 504 three thread overedge, 605 three needle cover stitch and seam class 3 (bound), so a user can pick them. Is that the right list? Are stitch classes missing that a factory would expect, such as 406 or 304?
- The explanations of each class are plain drafts. Are they right?
- Is the neckband a bound seam (class 3), with a cover stitch, on your tees? Today it is class 1 with 514.
- Does a taped shoulder or a taped back neck need its own seam line?
- Buttonholes and button sewing are not seams. Should the construction section list them?
- Stitch density is free text and is never proposed. Should it have a unit and a range instead, for example stitches per inch?
- The stitch class of a seam is one class. Some seams use two lines of stitching, such as a cover stitch on top of an overlock. Is one class for each seam enough?

## Components (added in step 8)

The design implies these, and the user describes them. No quantity is ever proposed.

- Main thread, brand label, care label and size label: always.
- Rib for the neckband (no collar), for the cuffs (ribbed cuffs) and for the collar (polo or band collar).
- Buttons (buttoned placket) and zip (zipped placket).
- Is that the right list? Missing ideas: topstitching thread, neck tape, swing tag, hang tag, size sticker, poly bag, shoulder tape, drawcord.
- Rib appears twice in the document: as the fabric of the neckband and cuffs panels, and as a rib line. Should it appear once?
- Any user-described extra component (an item the registry does not imply) is not supported yet.
- Fabric consumption is one free text field on each fabric. Should consumption be for each panel group instead, or for the whole garment?
