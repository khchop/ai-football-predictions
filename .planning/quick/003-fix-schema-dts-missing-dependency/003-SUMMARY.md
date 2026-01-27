# Quick Summary: Fix deployment failure - missing schema-dts dependency

## Completed
- Moved schema-dts from devDependencies to dependencies
- Regenerated package-lock.json

## Files Changed
- `package.json` - Moved schema-dts to dependencies section
- `package-lock.json` - Regenerated to include schema-dts

## Verification
- Build should now pass (schema-dts types available in production)