#!/bin/sh
set -eu
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CREATOR_BIN='/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator'
PLATFORM=bytedance-mini-game
PREVIEW_FLAG=
for arg in "$@"; do
  case "$arg" in
    --web) PLATFORM=web-mobile ;;
    --preview) PREVIEW_FLAG=--preview ;;
    *) echo "Usage: build-release.sh [--web] [--preview]" >&2; exit 2 ;;
  esac
done
# Rebuild generated files only. Local dev-session data is retained.
node "$PROJECT_DIR/tools/clean-build.cjs" "$PLATFORM"
BUILD_STATUS=0
"$CREATOR_BIN" --project "$PROJECT_DIR" --build "platform=$PLATFORM;debug=false;sourceMaps=false;startScene=524a411a-246f-4f83-a1f5-f06cf16bdbc1" || BUILD_STATUS=$?
# Creator uses exit status 36 for a successful build.
if [ "$BUILD_STATUS" -ne 36 ] && [ "$BUILD_STATUS" -ne 0 ]; then exit "$BUILD_STATUS"; fi
node "$PROJECT_DIR/tools/finalize-build.cjs" "$PLATFORM" $PREVIEW_FLAG
node "$PROJECT_DIR/tools/check-build.cjs" "$PLATFORM"
if [ "$PLATFORM" = bytedance-mini-game ]; then
  ttmg check -d "$PROJECT_DIR/build/$PLATFORM" --fail-on warning
fi
