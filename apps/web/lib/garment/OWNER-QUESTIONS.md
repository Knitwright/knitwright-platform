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

**None of these numbers has been checked against the standards.** Nobody who wrote or reviewed
them could read ISO 4915 (stitch types) or ISO 4916 (seam classes). They come from general
knowledge of knitwear. A factory, or a copy of both standards, must check every number and every
explanation before anyone relies on them. The document shows each one as "Proposed by Knitwright.
Not confirmed by anyone." until the user chooses one.

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
| Sleeve hem | both sleeves | no ribbed cuffs | 6 edge finish | 406 two needle bottom cover stitch |
| Cuff seam | both sleeves, cuffs | ribbed cuffs | 1 superimposed | 514 four thread overedge |
| Body hem | body front, body back | always | 6 edge finish | 406 two needle bottom cover stitch |
| Side vent finish | body front, body back | side vents | 6 edge finish | 301 lockstitch |
| Neckband seam | neckband, body front, body back | no collar | 1 superimposed | 514 four thread overedge |
| Collar seam | collar, body front, body back | polo or band collar | 1 superimposed | 514 four thread overedge |
| Placket seam | placket, body front | buttons | 2 lapped | 301 lockstitch |
| Zip seam | placket, body front | zip (one seam, not two) | 2 lapped | 301 lockstitch |
| V neck point (mitre) | neckband, body front | V neck, no collar | 1 superimposed | 301 lockstitch |

- Are these the right seam classes and stitch classes for knitted tops? In particular: is 514 right for every joining seam, or do some factories use 504 or 401? Hems now use 406, the usual hem of a tee. A reviewer doubted whether 406 or 602 is right for a tee hem, and whether 301 lockstitch is right for a placket on knitted fabric.
- The explanation of 602 was corrected after review: the cover thread lies on top and the looper thread underneath. 406 was added to the catalogue with the covering thread on the underside. Both explanations need a factory's eye.
- Proposals added after review, each shown as a proposal: shoulder tape (a part, to be confirmed, with a shoulder seam), the mitre at the point of a V neck (a seam, stitched with 301), and buttonholes with buttons on a buttoned placket. Is that the right list? Is a mitre a seam, or only a way of sewing the neckband?
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

## Bottoms (added in step 16)

Every entry below is a starting proposal written without a garment professional. The
owner confirms or changes each one with A5. Changing an answer is a data edit in
`registry/bottoms/`.

### Types and choices I made up

- Types: shorts, joggers, leggings, track pants. Each is made for men, women and youth.
- Leg length: short (above the knee), cropped (between knee and ankle), full. Shorts are short only, leggings cropped or full, joggers and track pants full only.
- Waistband: elastic with drawcord, elastic with no drawcord, wide flat band. Leggings offer the wide band or elastic; the others offer the two elastic bands.
- Leg opening: plain hem, ribbed cuffs, zip at the ankle. Joggers always have ribbed cuffs. Only track pants offer the ankle zip.
- Gusset: none or a crotch gusset, offered on every type. Leggings start with one.
- Side stripe: none or a contrast stripe down the outside of each leg, on every type.
- Pockets: none, side seam pockets, zipped side pockets. Leggings offer no pockets. Should they offer a waistband or side phone pocket?
- Leggings have no fit choice, because they are made to fit close. Is that right?
- Panels that can be coloured: front of the legs, back of the legs (both legs together on each side), waistband, gusset, side stripes, cuffs. Should the left and right leg be separate panels?
- Artwork anchors: left and right thigh, left and right lower leg (front); centre back below the waistband, back of each thigh (back). The waistband carries no artwork. Should it?
- The drawcord is a component, not a coloured panel. Its colour is written in its description.

### Impossible combinations

- A zip at the ankle on a short leg is refused. No type offers both today, so the rule only guards a later change of which choices a type offers. Are there other combinations that cannot be made?

### How to measure sentences a factory should check

- Hip: "at the fullest part of the seat, where the front seam starts to curve in towards the legs". Factories usually give a set distance below the waist. Which?
- Waist, stretched: "as far as it goes without straining the stitches". Confirm how a factory stretches it.
- Thigh: "just below the point where the legs meet". Factories often give a set distance below the crotch.
- Knee: "halfway down the inside leg seam". Some factories measure a set distance up from the hem, or down from the crotch.
- Rise: measured along the curve of the seam, to the top of the waistband. Some factories measure to the waist seam instead.
- Outside leg: from the top of the waistband. Confirm.

### Construction and components (a factory must confirm every one)

| Seam | Joins | When | Seam class | Stitch class |
|---|---|---|---|---|
| Front rise seam | front of the legs | always | 1 superimposed | 514 four thread overedge |
| Back rise seam | back of the legs | always | 1 superimposed | 514 four thread overedge |
| Inside leg seam | front and back of the legs | always | 1 superimposed | 514 four thread overedge |
| Outside leg seam | front and back of the legs | no side stripe | 1 superimposed | 514 four thread overedge |
| Side stripe seam | legs and side stripes | contrast stripe | 1 superimposed | 514 four thread overedge |
| Gusset seam | gusset and legs | crotch gusset | 1 superimposed | 514 four thread overedge |
| Waistband seam | waistband and legs | always | 1 superimposed | 514 four thread overedge |
| Waistband casing | waistband | elastic waistbands | 6 edge finish | 406 two needle bottom cover stitch |
| Leg hem | legs | plain hem or ankle zip | 6 edge finish | 406 two needle bottom cover stitch |
| Cuff seam | legs and cuffs | ribbed cuffs | 1 superimposed | 514 four thread overedge |
| Ankle zip seam | legs | ankle zip | 2 lapped | 301 lockstitch |
| Side pocket seam | legs | side seam pockets | 1 superimposed | 514 four thread overedge |
| Zipped pocket seam | front of the legs | zipped side pockets | 2 lapped | 301 lockstitch |

- Leggings are often sewn with flat seams (flatlock) so no ridge sits against the skin. Today they get the same overlocked seams as joggers. Should leggings seams be flatlock by default? Close-fitting garments (step 22) offer a choice of seam type.
- Components: thread and labels, waistband elastic (elastic waistbands), drawcord and drawcord exits (drawcord waistband; the exits are a proposal), cuff rib, ankle zips, pocket zips, pocket bags. Missing ideas: cord stoppers, cord tips, a key loop, reflective trims.
