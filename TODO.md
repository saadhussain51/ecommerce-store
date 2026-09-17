# TODO - Category & Collection Management Enhancements

## Steps

1. **server.js** - Add `GET /api/collections/:id` endpoint (fixes Collection Edit)
2. **server.js** - Add `PUT /api/categories/:name` endpoint (enables Category rename)
3. **admin/dashboard.html** - Add Edit/Rename button in Categories table
4. **admin/dashboard.html** - Fix `editCollection()` to use new endpoint
5. **collections.json** - Create file with sample collections (Winter, Summer)
6. **Test** - Restart server and verify all flows

## Progress

- [x] Step 1: GET /api/collections/:id
- [x] Step 2: PUT /api/categories/:name
- [x] Step 3: Categories Edit button in admin
- [x] Step 4: Fix editCollection()
- [x] Step 5: collections.json sample data
- [x] Step 6: Test (collections list, single collection, category rename, all verified working)
