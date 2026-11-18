#!/bin/sh
set -eu
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CREATOR_BIN='/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator'
BUILD_STATUS=0
"$CREATOR_BIN" --project "$PROJECT_DIR" --build 'platform=bytedance-mini-game;debug=false;sourceMaps=false;startScene=524a411a-246f-4f83-a1f5-f06cf16bdbc1' || BUILD_STATUS=$?
# Creator uses exit status 36 for a successful build.
if [ "$BUILD_STATUS" -ne 36 ] && [ "$BUILD_STATUS" -ne 0 ]; then exit "$BUILD_STATUS"; fi
cd "$PROJECT_DIR"
ttmg check -d build/bytedance-mini-game --fail-on warning
