# Drafts the JSY-SS-01 review pattern from article.json and writes, per size:
#   pattern/JSY-SS-01_<size>.svg  (1:1 in mm, cut line, sew line, notches, grain, labels)
#   pattern/JSY-SS-01_<size>.dxf  (R12 ASCII, mm, layers 1 cut / 14 sew / 4 notch / 7 grain / 15 text)
# plus pattern/JSY-SS-01_nest.svg (all sizes stacked) and pattern/pattern-report.md (measurement checks).
# This is a review draft for the factory. Production files come from the Python files service (ezdxf, ASTM D6673).
# Usage: powershell -File knitwright-build/articles/JSY-SS-01/tools/draft-pattern.ps1
param([string]$ArticleDir = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$inv = [Globalization.CultureInfo]::InvariantCulture
function F([double]$v) { $v.ToString('0.##', $inv) }

$art = Get-Content -Raw (Join-Path $ArticleDir 'article.json') | ConvertFrom-Json
$outDir = Join-Path $ArticleDir 'pattern'
New-Item -ItemType Directory -Force $outDir | Out-Null
$code = $art.code
$ver = $art.version
$sa = $art.seam_allowance
$k = $art.draft_constants

function Pom([string]$letter, [string]$size) { [double](($art.pom | Where-Object { $_.letter -eq $letter }).values.$size) }

# ---------- geometry helpers ----------
function Bez($p0, $p1, $p2, $p3, [int]$n = 60) {
  $pts = New-Object System.Collections.Generic.List[object]
  for ($i = 0; $i -le $n; $i++) {
    $t = $i / $n; $u = 1 - $t
    $x = $u*$u*$u*$p0[0] + 3*$u*$u*$t*$p1[0] + 3*$u*$t*$t*$p2[0] + $t*$t*$t*$p3[0]
    $y = $u*$u*$u*$p0[1] + 3*$u*$u*$t*$p1[1] + 3*$u*$t*$t*$p2[1] + $t*$t*$t*$p3[1]
    $pts.Add([double[]]@($x, $y))
  }
  return ,$pts.ToArray()
}
function Line($a, $b) { return ,@([double[]]$a, [double[]]$b) }
function Rev($pts) { $r = @($pts); [array]::Reverse($r); return ,$r }
function Mir($pts) { return ,@($pts | ForEach-Object { ,([double[]]@(-$_[0], $_[1])) }) }
function Len($pts) { $s = 0.0; for ($i = 1; $i -lt $pts.Count; $i++) { $s += [math]::Sqrt([math]::Pow($pts[$i][0]-$pts[$i-1][0],2) + [math]::Pow($pts[$i][1]-$pts[$i-1][1],2)) }; return $s }
# Point builder. PowerShell variables are case-insensitive and ',' binds tighter than '*' and '+',
# so every computed point is built as V (expr) (expr), never @(a + b, c + d).
function V([double]$x, [double]$y) { return ,([double[]]@($x, $y)) }
function Unit([double]$dx, [double]$dy) { $l = [math]::Sqrt($dx*$dx + $dy*$dy); if ($l -lt 1e-9) { return (V 0 0) }; return (V ($dx/$l) ($dy/$l)) }

# Point and tangent at arc length along a polyline
function At($pts, [double]$dist) {
  $acc = 0.0
  for ($i = 1; $i -lt $pts.Count; $i++) {
    $dx = $pts[$i][0]-$pts[$i-1][0]; $dy = $pts[$i][1]-$pts[$i-1][1]
    $l = [math]::Sqrt($dx*$dx + $dy*$dy)
    if ($acc + $l -ge $dist -and $l -gt 0) {
      $t = ($dist - $acc) / $l
      return @{ p = (V ($pts[$i-1][0] + $dx*$t) ($pts[$i-1][1] + $dy*$t)); d = (Unit $dx $dy) }
    }
    $acc += $l
  }
  $n = $pts.Count
  return @{ p = $pts[$n-1]; d = (Unit ($pts[$n-1][0]-$pts[$n-2][0]) ($pts[$n-1][1]-$pts[$n-2][1])) }
}

# Closed outline from segments (clockwise on screen, y down). Each segment: @{ pts; sa }
function Outline($segs) {
  $pointList = New-Object System.Collections.Generic.List[object]
  $allowList = New-Object System.Collections.Generic.List[double]
  foreach ($seg in $segs) {
    $pts = $seg.pts
    for ($i = 0; $i -lt $pts.Count - 1; $i++) { $pointList.Add($pts[$i]); $allowList.Add([double]$seg.sa) }
  }
  return @{ P = $pointList.ToArray(); S = $allowList.ToArray() }
}

# Offset outward by per-edge seam allowance; outward normal of edge direction (dx,dy) is (dy,-dx)
function OffsetOutline($pointArr, $allowArr) {
  $n = $pointArr.Count
  $res = New-Object System.Collections.Generic.List[object]
  for ($i = 0; $i -lt $n; $i++) {
    $a = $pointArr[($i - 1 + $n) % $n]; $b = $pointArr[$i]; $c = $pointArr[($i + 1) % $n]
    $s1 = $allowArr[($i - 1 + $n) % $n]; $s2 = $allowArr[$i]
    $d1 = Unit ($b[0]-$a[0]) ($b[1]-$a[1]); $d2 = Unit ($c[0]-$b[0]) ($c[1]-$b[1])
    $n1 = V $d1[1] (-$d1[0]); $n2 = V $d2[1] (-$d2[0])
    $p1 = V ($a[0] + $n1[0]*$s1) ($a[1] + $n1[1]*$s1)
    $p2 = V ($b[0] + $n2[0]*$s2) ($b[1] + $n2[1]*$s2)
    $cross = $d1[0]*$d2[1] - $d1[1]*$d2[0]
    $fallback = V ($b[0] + $n2[0]*$s2) ($b[1] + $n2[1]*$s2)
    if ([math]::Abs($cross) -lt 1e-3) { $res.Add($fallback); continue }
    $t = (($p2[0]-$p1[0])*$d2[1] - ($p2[1]-$p1[1])*$d2[0]) / $cross
    $q = V ($p1[0] + $d1[0]*$t) ($p1[1] + $d1[1]*$t)
    $dist = [math]::Sqrt([math]::Pow($q[0]-$b[0],2) + [math]::Pow($q[1]-$b[1],2))
    if ($dist -gt 3 * [math]::Max($s1, $s2)) { $res.Add($fallback) } else { $res.Add($q) }
  }
  return ,$res.ToArray()
}

# Notch: a 5 mm cut into the seam allowance, at arc length on a traversal-ordered curve
function Notch($curve, [double]$dist, [double]$allow) {
  $r = At $curve $dist
  $nx = $r.d[1]; $ny = -$r.d[0]
  $cut = V ($r.p[0] + $nx*$allow) ($r.p[1] + $ny*$allow)
  return ,@($cut, (V ($cut[0] - $nx*5) ($cut[1] - $ny*5)))
}

# ---------- draft one size ----------
function Draft([string]$size) {
  $pA = Pom 'A' $size; $pB = Pom 'B' $size; $pC = Pom 'C' $size; $pD = Pom 'D' $size
  $pE = Pom 'E' $size; $pF = Pom 'F' $size; $pG = Pom 'G' $size; $pH = Pom 'H' $size
  $pI = Pom 'I' $size; $pJ = Pom 'J' $size; $pL = Pom 'L' $size
  $A = $pA; $B = $pB; $C = $pC; $D = $pD; $E = $pE; $Fo = $pF; $G = $pG; $I = $pI; $J = $pJ; $L = $pL
  $slope = [double]$k.shoulder_slope
  $cx = $pA / 2; $sx = $pC / 2; $hx = $pH / 2

  # Front (right half, then mirrored)
  $fNeck = Bez (V $hx 0) (V $hx ($pI*0.55)) (V ($hx*0.5) $pI) (V 0 $pI)            # HPS -> CF
  $fArm  = Bez (V $sx $slope) (V ($sx-0.12*($pG-$slope)) ($slope+0.4*($pG-$slope))) (V ($sx-10) $pG) (V $cx $pG)   # SP -> UA
  $bNeck = Bez (V $hx 0) (V ($hx-5) ($pJ*0.8)) (V ($hx*0.5) $pJ) (V 0 $pJ)
  $bArm  = Bez (V $sx $slope) (V ($sx-0.08*($pG-$slope)) ($slope+0.4*($pG-$slope))) (V ($sx-5) $pG) (V $cx $pG)

  $front = @{ name = 'FRONT'; cut = 1; segs = @(
    @{ pts = (Rev $fNeck); sa = $sa.neck; tag = 'neckR' },
    @{ pts = (Line @($hx,0) @($sx,$slope)); sa = $sa.shoulder },
    @{ pts = $fArm; sa = $sa.armhole; tag = 'armR' },
    @{ pts = (Line @($cx,$G) @($cx,$B)); sa = $sa.side },
    @{ pts = (Line @($cx,$B) @(-$cx,$B)); sa = $sa.body_hem },
    @{ pts = (Line @(-$cx,$B) @(-$cx,$G)); sa = $sa.side },
    @{ pts = (Rev (Mir $fArm)); sa = $sa.armhole; tag = 'armL' },
    @{ pts = (Line @(-$sx,$slope) @(-$hx,0)); sa = $sa.shoulder },
    @{ pts = (Mir $fNeck); sa = $sa.neck }
  ) }
  $back = @{ name = 'BACK'; cut = 1; segs = @(
    @{ pts = (Rev $bNeck); sa = $sa.neck },
    @{ pts = (Line @($hx,0) @($sx,$slope)); sa = $sa.shoulder },
    @{ pts = $bArm; sa = $sa.armhole; tag = 'armR' },
    @{ pts = (Line @($cx,$G) @($cx,$B)); sa = $sa.side },
    @{ pts = (Line @($cx,$B) @(-$cx,$B)); sa = $sa.body_hem },
    @{ pts = (Line @(-$cx,$B) @(-$cx,$G)); sa = $sa.side },
    @{ pts = (Rev (Mir $bArm)); sa = $sa.armhole; tag = 'armL' },
    @{ pts = (Line @(-$sx,$slope) @(-$hx,0)); sa = $sa.shoulder },
    @{ pts = (Mir $bNeck); sa = $sa.neck }
  ) }

  $lfArm = Len $fArm; $lbArm = Len $bArm
  $target = ($lfArm + $lbArm + 3) / 2          # 3 mm total ease, inside the 0-6 mm target

  # Sleeve cap: solve cap height so each half of the cap matches the target length
  $lo = 30.0; $hi = 200.0
  for ($it = 0; $it -lt 40; $it++) {
    $capH = ($lo + $hi) / 2
    $cap = Bez (V $pE $capH) (V ($pE*0.6) $capH) (V ($pE*0.35) 0) (V 0 0)
    if ((Len $cap) -gt $target) { $hi = $capH } else { $lo = $capH }
  }
  $capH = ($lo + $hi) / 2
  $h = $capH
  $cap = Bez (V $pE $capH) (V ($pE*0.6) $capH) (V ($pE*0.35) 0) (V 0 0)          # UA(front side) -> top
  $lCap = Len $cap
  $sleeve = @{ name = 'SLEEVE'; cut = 2; segs = @(
    @{ pts = (Rev $cap); sa = $sa.armhole; tag = 'capR' },          # top -> front underarm
    @{ pts = (Line @($E,$h) @($Fo,$D)); sa = $sa.sleeve_underarm },
    @{ pts = (Line @($Fo,$D) @(-$Fo,$D)); sa = $sa.sleeve_hem },
    @{ pts = (Line @(-$Fo,$D) @(-$E,$h)); sa = $sa.sleeve_underarm },
    @{ pts = (Mir $cap); sa = $sa.armhole; tag = 'capL' }           # back underarm -> top
  ) }

  $neckLen = 2 * ((Len $fNeck) + (Len $bNeck))
  $ribLen = [math]::Round($neckLen * [double]$k.rib_ratio)
  $ribW = 2 * $L
  $rib = @{ name = 'NECK RIB C01'; cut = 1; segs = @(
    @{ pts = (Line @(0,0) @($ribLen,0)); sa = $sa.rib },
    @{ pts = (Line @($ribLen,0) @($ribLen,$ribW)); sa = $sa.rib },
    @{ pts = (Line @($ribLen,$ribW) @(0,$ribW)); sa = $sa.rib },
    @{ pts = (Line @(0,$ribW) @(0,0)); sa = $sa.rib }
  ) }

  # Notches (on cut line, 5 mm deep)
  $notches = @{}
  $notches.FRONT = @(
    (Notch (Rev $fNeck) 0.01 $sa.neck), (Notch (Line @($cx,$B) @(-$cx,$B)) $cx $sa.body_hem),
    (Notch $fArm ((Len $fArm) - 75) $sa.armhole), (Notch (Rev (Mir $fArm)) 75 $sa.armhole)
  )
  $notches.BACK = @(
    (Notch (Rev $bNeck) 0.01 $sa.neck), (Notch (Line @($cx,$B) @(-$cx,$B)) $cx $sa.body_hem),
    (Notch $bArm ((Len $bArm) - 85) $sa.armhole), (Notch $bArm ((Len $bArm) - 95) $sa.armhole),
    (Notch (Rev (Mir $bArm)) 85 $sa.armhole), (Notch (Rev (Mir $bArm)) 95 $sa.armhole)
  )
  $notches.SLEEVE = @(
    (Notch (Rev $cap) 0.01 $sa.armhole),
    (Notch (Rev $cap) ($lCap - 75) $sa.armhole),
    (Notch (Mir $cap) 85 $sa.armhole), (Notch (Mir $cap) 95 $sa.armhole)
  )
  $ribEdge = Line @(0,0) @($ribLen,0)
  $notches.'NECK RIB C01' = @(
    (Notch $ribEdge ($ribLen*0.25) $sa.rib), (Notch $ribEdge ($ribLen*0.5) $sa.rib), (Notch $ribEdge ($ribLen*0.75) $sa.rib)
  )

  $pieces = @($front, $back, $sleeve, $rib)
  foreach ($piece in $pieces) {
    $o = Outline $piece.segs
    $piece.sew = $o.P
    $piece.cutline = OffsetOutline $o.P $o.S
    $piece.notches = $notches[$piece.name]
  }

  return @{
    size = $size; pieces = $pieces
    check = [ordered]@{
      'A chest half (front panel width at underarm)' = (V $pA (2*$cx))
      'C across shoulder' = (V $pC (2*$sx))
      'H neck width' = (V $pH (2*$hx))
      'I front neck drop' = (V $pI ($fNeck[$fNeck.Count-1][1]))
      'G armhole depth' = (V $pG ($fArm[$fArm.Count-1][1]))
      'B body length' = (V $pB $pB)
      'D sleeve length' = (V $pD $pD)
      'E bicep half (sleeve width / 2)' = (V $pE $pE)
      'F sleeve opening half' = (V $pF $pF)
      'K hem width half' = (V $pA (2*$cx))
    }
    lens = [ordered]@{
      'Front armhole (one side)' = $lfArm; 'Back armhole (one side)' = $lbArm
      'Sleeve cap, front half' = $lCap; 'Sleeve cap, back half' = $lCap
      'Total ease, cap vs armhole' = (2*$lCap - $lfArm - $lbArm)
      'Sleeve cap height' = $capH
      'Neckline seam (full)' = $neckLen; 'Rib length (finished seam line)' = $ribLen
    }
  }
}

function BBox($pts) {
  $xs = $pts | ForEach-Object { $_[0] }; $ys = $pts | ForEach-Object { $_[1] }
  return @{ x0 = ($xs | Measure-Object -Minimum).Minimum; x1 = ($xs | Measure-Object -Maximum).Maximum
            y0 = ($ys | Measure-Object -Minimum).Minimum; y1 = ($ys | Measure-Object -Maximum).Maximum }
}
function PathD($pts, [double]$ox, [double]$oy) {
  $sb = New-Object System.Text.StringBuilder
  for ($i = 0; $i -lt $pts.Count; $i++) {
    [void]$sb.Append($(if ($i -eq 0) { 'M' } else { 'L' })).Append((F ($pts[$i][0]+$ox))).Append(' ').Append((F ($pts[$i][1]+$oy))).Append(' ')
  }
  return $sb.Append('Z').ToString()
}

# ---------- write files ----------
$sizes = @($art.sizes)
$drafts = @{}
foreach ($s in $sizes) { $drafts[$s] = Draft $s }

$gap = 50; $margin = 30
foreach ($s in $sizes) {
  $dft = $drafts[$s]
  $x = $margin; $maxH = 0
  $svg = New-Object System.Text.StringBuilder
  $dxf = New-Object System.Text.StringBuilder
  [void]$dxf.Append("0`nSECTION`n2`nHEADER`n9`n`$ACADVER`n1`nAC1009`n9`n`$INSUNITS`n70`n4`n0`nENDSEC`n0`nSECTION`n2`nENTITIES`n")
  $body = New-Object System.Text.StringBuilder
  foreach ($pc in $dft.pieces) {
    $bb = BBox $pc.cutline
    $ox = $x - $bb.x0; $oy = $margin - $bb.y0
    $w = $bb.x1 - $bb.x0; $hgt = $bb.y1 - $bb.y0
    if ($hgt -gt $maxH) { $maxH = $hgt }
    [void]$body.Append("<g id=`"$($pc.name.ToLower().Replace(' ','_'))`">")
    [void]$body.Append("<path d=`"$(PathD $pc.cutline $ox $oy)`" fill=`"none`" stroke=`"#000`" stroke-width=`"0.6`"/>")
    [void]$body.Append("<path d=`"$(PathD $pc.sew $ox $oy)`" fill=`"none`" stroke=`"#777`" stroke-width=`"0.3`" stroke-dasharray=`"4 2`"/>")
    foreach ($nt in $pc.notches) {
      [void]$body.Append("<line x1=`"$(F ($nt[0][0]+$ox))`" y1=`"$(F ($nt[0][1]+$oy))`" x2=`"$(F ($nt[1][0]+$ox))`" y2=`"$(F ($nt[1][1]+$oy))`" stroke=`"#d00`" stroke-width=`"0.6`"/>")
    }
    $cxm = $x + $w/2; $gy0 = $margin + $hgt*0.3; $gy1 = $margin + $hgt*0.8
    if ($pc.name -like 'NECK RIB*') { $gy0 = $margin + 4; $gy1 = $margin + $hgt - 4; $cxm = $x + 30 }
    [void]$body.Append("<line x1=`"$(F $cxm)`" y1=`"$(F $gy0)`" x2=`"$(F $cxm)`" y2=`"$(F $gy1)`" stroke=`"#06c`" stroke-width=`"0.5`" marker-start=`"url(#a)`" marker-end=`"url(#a)`"/>")
    $ty = $margin + $hgt*0.42
    if ($pc.name -like 'NECK RIB*') { $ty = $margin + $hgt + 12; $cxm = $x + $w/2 }
    $fab = $(if ($pc.name -like 'NECK RIB*') { $art.fabrics.rib.code } else { $art.fabrics.body.code })
    $lines = @("$code v$ver", $pc.name, "Size $s", "Cut $($pc.cut) - $fab", "Grain: vertical")
    $ly = $ty
    foreach ($t in $lines) {
      [void]$body.Append("<text x=`"$(F ($cxm + 6))`" y=`"$(F $ly)`" font-family=`"Arial`" font-size=`"9`" fill=`"#000`">$t</text>"); $ly += 12
    }
    [void]$body.Append("</g>")

    # DXF (y flipped so the pattern reads the right way up)
    [void]$dxf.Append("0`nPOLYLINE`n8`n1`n66`n1`n70`n1`n")
    foreach ($p in $pc.cutline) { [void]$dxf.Append("0`nVERTEX`n8`n1`n10`n$(F ($p[0]+$ox))`n20`n$(F (-($p[1]+$oy)))`n") }
    [void]$dxf.Append("0`nSEQEND`n8`n1`n")
    [void]$dxf.Append("0`nPOLYLINE`n8`n14`n66`n1`n70`n1`n")
    foreach ($p in $pc.sew) { [void]$dxf.Append("0`nVERTEX`n8`n14`n10`n$(F ($p[0]+$ox))`n20`n$(F (-($p[1]+$oy)))`n") }
    [void]$dxf.Append("0`nSEQEND`n8`n14`n")
    foreach ($nt in $pc.notches) { [void]$dxf.Append("0`nLINE`n8`n4`n10`n$(F ($nt[0][0]+$ox))`n20`n$(F (-($nt[0][1]+$oy)))`n11`n$(F ($nt[1][0]+$ox))`n21`n$(F (-($nt[1][1]+$oy)))`n") }
    [void]$dxf.Append("0`nLINE`n8`n7`n10`n$(F $cxm)`n20`n$(F (-$gy0))`n11`n$(F $cxm)`n21`n$(F (-$gy1))`n")
    $ly = $ty
    foreach ($t in $lines) { [void]$dxf.Append("0`nTEXT`n8`n15`n10`n$(F ($cxm + 6))`n20`n$(F (-$ly))`n40`n8`n1`n$t`n"); $ly += 12 }
    $x += $w + $gap
  }
  $W = [math]::Ceiling($x - $gap + $margin); $Ht = [math]::Ceiling($maxH + 2*$margin + 60)
  [void]$svg.Append("<?xml version=`"1.0`" encoding=`"UTF-8`"?>`n")
  [void]$svg.Append("<svg xmlns=`"http://www.w3.org/2000/svg`" width=`"$($W)mm`" height=`"$($Ht)mm`" viewBox=`"0 0 $W $Ht`">`n")
  [void]$svg.Append("<defs><marker id=`"a`" viewBox=`"0 0 10 10`" refX=`"5`" refY=`"5`" markerWidth=`"4`" markerHeight=`"4`" orient=`"auto-start-reverse`"><path d=`"M0 0L10 5L0 10z`" fill=`"#06c`"/></marker></defs>`n")
  [void]$svg.Append("<rect width=`"100%`" height=`"100%`" fill=`"#fff`"/>`n")
  [void]$svg.Append($body.ToString())
  $note = "$code v$ver - size $s - 1:1 scale, units mm - solid = cut line (seam allowance included), dashed = sew line, red = notches, blue = grain - DRAFT FOR FACTORY REVIEW"
  [void]$svg.Append("<text x=`"$margin`" y=`"$($Ht - 15)`" font-family=`"Arial`" font-size=`"8`" fill=`"#444`">$note</text>")
  [void]$svg.Append("<g transform=`"translate($margin,$($Ht - 45))`"><line x1=`"0`" y1=`"0`" x2=`"100`" y2=`"0`" stroke=`"#000`" stroke-width=`"0.6`"/><line x1=`"0`" y1=`"-4`" x2=`"0`" y2=`"4`" stroke=`"#000`"/><line x1=`"100`" y1=`"-4`" x2=`"100`" y2=`"4`" stroke=`"#000`"/><text x=`"0`" y=`"12`" font-family=`"Arial`" font-size=`"8`">Check: this bar must measure 100 mm when printed</text></g>`n")
  [void]$svg.Append("</svg>`n")
  [void]$dxf.Append("0`nENDSEC`n0`nEOF`n")
  [IO.File]::WriteAllText((Join-Path $outDir "$($code)_$s.svg"), $svg.ToString())
  [IO.File]::WriteAllText((Join-Path $outDir "$($code)_$s.dxf"), $dxf.ToString())
}

# Nest: all sizes stacked per piece, same origin (HPS/CF for body, cap top/centre for sleeve)
$colours = @{ XS = '#7b3294'; S = '#2c7bb6'; M = '#000000'; L = '#1a9641'; XL = '#d7191c'; '2XL' = '#fdae61'; '3XL' = '#e66101' }
$big = $drafts[$sizes[-1]]
$nest = New-Object System.Text.StringBuilder
$x = $margin; $maxH = 0
for ($pi = 0; $pi -lt $big.pieces.Count; $pi++) {
  $bb = BBox $big.pieces[$pi].cutline
  $ox = $x - $bb.x0; $oy = $margin + 20 - $bb.y0
  foreach ($s in $sizes) {
    $pc = $drafts[$s].pieces[$pi]
    $wgt = $(if ($s -eq $art.base_size) { '0.6' } else { '0.3' })
    [void]$nest.Append("<path d=`"$(PathD $pc.cutline $ox $oy)`" fill=`"none`" stroke=`"$($colours[$s])`" stroke-width=`"$wgt`"/>")
  }
  [void]$nest.Append("<text x=`"$x`" y=`"$($margin + 10)`" font-family=`"Arial`" font-size=`"10`">$($big.pieces[$pi].name)</text>")
  $w = $bb.x1 - $bb.x0; $hgt = $bb.y1 - $bb.y0
  if ($hgt -gt $maxH) { $maxH = $hgt }
  $x += $w + $gap
}
$W = [math]::Ceiling($x - $gap + $margin); $Ht = [math]::Ceiling($maxH + 2*$margin + 60)
$legend = ($sizes | ForEach-Object { "<tspan fill=`"$($colours[$_])`">$_  </tspan>" }) -join ''
$nestSvg = "<?xml version=`"1.0`" encoding=`"UTF-8`"?>`n<svg xmlns=`"http://www.w3.org/2000/svg`" width=`"$($W)mm`" height=`"$($Ht)mm`" viewBox=`"0 0 $W $Ht`"><rect width=`"100%`" height=`"100%`" fill=`"#fff`"/>" + $nest.ToString() + "<text x=`"$margin`" y=`"$($Ht - 20)`" font-family=`"Arial`" font-size=`"9`">$code v$ver graded nest, cut lines, 1:1 mm. Sizes: $legend (base size M in bold)</text></svg>"
[IO.File]::WriteAllText((Join-Path $outDir "$($code)_nest.svg"), $nestSvg)

# Report
$rep = New-Object System.Text.StringBuilder
[void]$rep.Append("# $code pattern report (v$ver)`n`nGenerated by ``tools/draft-pattern.ps1`` from ``article.json``. All values in mm.`n`n")
[void]$rep.Append("## Measurements built into the pattern vs the POM table`n`n| Check | " + ($sizes -join ' | ') + " |`n|---|" + (($sizes | ForEach-Object { '---' }) -join '|') + "|`n")
foreach ($key in $drafts[$sizes[0]].check.Keys) {
  $cells = $sizes | ForEach-Object { $v = $drafts[$_].check[$key]; if ([math]::Abs($v[0]-$v[1]) -lt 0.5) { "$(F $v[1]) OK" } else { "$(F $v[1]) CHECK (target $(F $v[0]))" } }
  [void]$rep.Append("| $key | " + ($cells -join ' | ') + " |`n")
}
[void]$rep.Append("`n## Seam lengths that must match`n`n| Length | " + ($sizes -join ' | ') + " |`n|---|" + (($sizes | ForEach-Object { '---' }) -join '|') + "|`n")
foreach ($key in $drafts[$sizes[0]].lens.Keys) {
  $cells = $sizes | ForEach-Object { F $drafts[$_].lens[$key] }
  [void]$rep.Append("| $key | " + ($cells -join ' | ') + " |`n")
}
[void]$rep.Append("`nSleeve cap ease target: $($k.sleeve_cap_ease_target[0])-$($k.sleeve_cap_ease_target[1]) mm in total (knit fabric, set flat). Rib length = neckline x $($k.rib_ratio).`n")
[IO.File]::WriteAllText((Join-Path $outDir 'pattern-report.md'), $rep.ToString(), (New-Object System.Text.UTF8Encoding $false))
"done: " + ($sizes -join ',')
