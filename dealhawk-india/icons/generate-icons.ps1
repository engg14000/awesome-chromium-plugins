Add-Type -AssemblyName System.Drawing

$sizes = @(16, 48, 128)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $s, $s
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.TextRenderingHint = 'AntiAlias'
    
    # Orange background
    $orangeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 105, 0))
    $g.FillRectangle($orangeBrush, 0, 0, $s, $s)
    
    # White text
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $fontSize = [Math]::Max(7, [int]($s * 0.32))
    $font = New-Object System.Drawing.Font('Arial', $fontSize, [System.Drawing.FontStyle]::Bold)
    
    $text = [char]0x20B9 + [string][char]0x2193
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = 'Center'
    $sf.LineAlignment = 'Center'
    $rect = New-Object System.Drawing.RectangleF(0, 0, $s, $s)
    $g.DrawString($text, $font, $whiteBrush, $rect, $sf)
    
    $outPath = Join-Path $scriptDir "icon$s.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $g.Dispose()
    $bmp.Dispose()
    $orangeBrush.Dispose()
    $whiteBrush.Dispose()
    $font.Dispose()
    $sf.Dispose()
    
    Write-Host "Created icon${s}.png at $outPath"
}
