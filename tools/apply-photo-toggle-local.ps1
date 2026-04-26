<# 
WestTechHA Local Photo Toggle Installer
LOCAL ONLY. Does not use GitHub. Run from your website root.

What it does:
- Adds the product-photo-toggle.js reference.
- Adds data-photo-legacy/data-photo-new attributes to existing product gallery images.
- Adds a small Photo set dropdown above Scout/Ranger galleries.
- Swaps checkout hero images for Scout 38 Black and Ranger 30 White.
- Leaves captions and existing wording alone.
#>

$ErrorActionPreference = "Stop"

function Backup-File {
    param([string]$Path)
    if (Test-Path $Path) {
        $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        Copy-Item $Path "$Path.bak-photo-toggle-$stamp"
    }
}

function Read-Utf8 {
    param([string]$Path)
    return [System.IO.File]::ReadAllText((Resolve-Path $Path), [System.Text.Encoding]::UTF8)
}

function Write-Utf8 {
    param([string]$Path, [string]$Content)
    [System.IO.File]::WriteAllText((Resolve-Path $Path), $Content, [System.Text.Encoding]::UTF8)
}

function Ensure-BodyDefault {
    param([string]$Html)
    if ($Html -match '<body[^>]*data-default-photo-set=') { return $Html }
    return $Html -replace '<body>', '<body data-default-photo-set="new">'
}

function Ensure-Script {
    param([string]$Html)
    if ($Html -match 'js/product-photo-toggle\.js') { return $Html }
    return $Html -replace '(?s)(<script src="js/gallery-lightbox\.js" defer></script>)', "`$1`r`n<script src=`"js/product-photo-toggle.js`" defer></script>"
}

function Add-PhotoData {
    param(
        [string]$Html,
        [string]$Legacy,
        [string]$New
    )

    if ($Html -match [regex]::Escape("data-photo-new=`"$New`"")) { return $Html }

    $escapedLegacy = [regex]::Escape($Legacy)
    return [regex]::Replace(
        $Html,
        "src=`"$escapedLegacy`"",
        "src=`"$Legacy`" data-photo-legacy=`"$Legacy`" data-photo-new=`"$New`"",
        1
    )
}

function Add-ToggleBeforeGallery {
    param(
        [string]$Html,
        [string]$Id,
        [string]$NewLabel,
        [string]$LegacyLabel
    )

    if ($Html -match [regex]::Escape("id=`"$Id`"")) { return $Html }

    $toggle = @"
    <div class="product-kicker-row" style="margin-bottom: 1rem;">
      <label class="checkout-quantity-label" for="$Id">
        <span>Photo set</span>
        <select id="$Id" class="checkout-quantity-select" data-photo-set-control>
          <option value="new" selected>$NewLabel</option>
          <option value="legacy">$LegacyLabel</option>
        </select>
      </label>
    </div>
"@

    return [regex]::Replace(
        $Html,
        '(\s*<div class="product-gallery product-gallery-grid">)',
        "`r`n$toggle`r`n`$1",
        1
    )
}

function Direct-Replace {
    param(
        [string]$Html,
        [string]$Old,
        [string]$New
    )
    return $Html.Replace($Old, $New)
}

# product-scout.html
if (Test-Path "product-scout.html") {
    Backup-File "product-scout.html"
    $h = Read-Utf8 "product-scout.html"
    $h = Ensure-BodyDefault $h

    $h = Add-PhotoData $h "images/products/small/small-hero-45deg-board-installed.jpeg" "images/products/scout/scout-38-black-hero-top-down-lid-inserts.jpg"
    $h = Add-ToggleBeforeGallery $h "scout-photo-set" "Scout 38 Black photos" "Legacy Small photos"

    $h = Add-PhotoData $h "images/products/small/small-assembled-lid-on-angle-a.jpeg" "images/products/scout/scout-38-black-assembled-lid-on-angle-a.jpg"
    $h = Add-PhotoData $h "images/products/small/small-empty-interior.jpeg" "images/products/scout/scout-38-black-empty-interior.jpg"
    $h = Add-PhotoData $h "images/products/small/small-board-installed-top-down.jpeg" "images/products/scout/scout-38-black-board-installed-top-down.jpg"
    $h = Add-PhotoData $h "images/products/small/small-front-usb-pwr-detail.jpeg" "images/products/scout/scout-38-black-front-uart-usb-pwr-detail.jpg"
    $h = Add-PhotoData $h "images/products/small/small-side-3v3-to-d23-detail.jpeg" "images/products/scout/scout-38-black-side-3v3-to-5v-detail.jpg"
    $h = Add-PhotoData $h "images/products/small/small-rear-en-to-vin-detail.jpeg" "images/products/scout/scout-38-black-rear-clk-to-gnd-detail.jpg"
    $h = Add-PhotoData $h "images/products/small/small-opposite-side-wire-detail.jpeg" "images/products/scout/scout-38-black-opposite-side-wire-detail.jpg"
    $h = Add-PhotoData $h "images/products/small/small-bottom-magnets.jpeg" "images/products/scout/scout-38-black-bottom-magnets.jpg"
    $h = Add-PhotoData $h "images/products/small/small-assembled-lid-on-angle-b.jpeg" "images/products/scout/scout-38-black-assembled-lid-on-angle-b.jpg"

    $h = Ensure-Script $h
    Write-Utf8 "product-scout.html" $h
    Write-Host "Updated product-scout.html"
}

# product-ranger.html
if (Test-Path "product-ranger.html") {
    Backup-File "product-ranger.html"
    $h = Read-Utf8 "product-ranger.html"
    $h = Ensure-BodyDefault $h

    $h = Add-PhotoData $h "images/products/med/med-hero-45deg-lid-on-black-38pin.jpg" "images/products/ranger/ranger-30-white-hero-top-down-lid-inserts.jpg"
    $h = Add-ToggleBeforeGallery $h "ranger-photo-set" "Ranger 30 White photos" "Legacy Med photos"

    $h = Add-PhotoData $h "images/products/med/med-assembled-lid-on-angle-b.jpg" "images/products/ranger/ranger-30-white-assembled-lid-on-angle-b.jpg"
    $h = Add-PhotoData $h "images/products/med/med-empty-interior.jpg" "images/products/ranger/ranger-30-white-empty-interior.jpg"
    $h = Add-PhotoData $h "images/products/med/med-board-relay-installed-top-down.jpg" "images/products/ranger/ranger-30-white-board-relay-installed-top-down.jpg"
    $h = Add-PhotoData $h "images/products/med/med-front-uart-usb-pwr-detail.jpg" "images/products/ranger/ranger-30-white-front-uart-usb-pwr-detail.jpg"
    $h = Add-PhotoData $h "images/products/med/med-side-3v3-to-5v-detail.jpg" "images/products/ranger/ranger-30-white-side-3v3-to-d23-detail.jpg"
    $h = Add-PhotoData $h "images/products/med/med-rear-clk-to-gnd-detail.jpg" "images/products/ranger/ranger-30-white-rear-en-to-vin-detail.jpg"
    $h = Add-PhotoData $h "images/products/med/med-opposite-side-wire-detail.jpg" "images/products/ranger/ranger-30-white-opposite-side-wire-detail.jpg"
    $h = Add-PhotoData $h "images/products/med/med-bottom-magnets.jpg" "images/products/ranger/ranger-30-white-bottom-magnets.jpg"
    $h = Add-PhotoData $h "images/products/med/med-open-45deg-board-installed.jpg" "images/products/ranger/ranger-30-white-open-board-installed-top-down-small.jpg"

    $h = Ensure-Script $h
    Write-Utf8 "product-ranger.html" $h
    Write-Host "Updated product-ranger.html"
}

# Checkout hero swaps for the two uploaded product sets.
if (Test-Path "checkout-scout-38-unloaded.html") {
    Backup-File "checkout-scout-38-unloaded.html"
    $h = Read-Utf8 "checkout-scout-38-unloaded.html"
    $h = $h.Replace("images/products/small/small-hero-45deg-board-installed.jpeg", "images/products/scout/scout-38-black-hero-top-down-lid-inserts.jpg")
    Write-Utf8 "checkout-scout-38-unloaded.html" $h
    Write-Host "Updated checkout-scout-38-unloaded.html hero"
}

if (Test-Path "checkout-ranger-30-unloaded.html") {
    Backup-File "checkout-ranger-30-unloaded.html"
    $h = Read-Utf8 "checkout-ranger-30-unloaded.html"
    $h = $h.Replace("images/products/med/med-hero-45deg-lid-on-black-38pin.jpg", "images/products/ranger/ranger-30-white-hero-top-down-lid-inserts.jpg")
    Write-Utf8 "checkout-ranger-30-unloaded.html" $h
    Write-Host "Updated checkout-ranger-30-unloaded.html hero"
}

Write-Host ""
Write-Host "Done. Local files only. Backups created next to edited HTML files."
