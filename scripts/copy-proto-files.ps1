# Copy only necessary proto files to release directory
$protoSource = "./external/nicolive-comment-protobuf/proto"
$protoDest = "./release/external/nicolive-comment-protobuf/proto"

if (Test-Path -Path $protoSource) {
    Write-Host "[release] Copying protobuf definitions..."
    New-Item -ItemType Directory -Path $protoDest -Force | Out-Null
    Copy-Item -Path "$protoSource/*" -Destination $protoDest -Recurse -Force
    Write-Host "[release] Protobuf definitions copied successfully"
} else {
    Write-Warning "[release] Protobuf definitions not found at $protoSource"
}
