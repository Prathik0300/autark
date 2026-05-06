.PHONY: dev

CONCURRENTLY := npx concurrently
RIMRAF := rm -rf

install:
	$(CONCURRENTLY) "cd autk-map && npm install" "cd autk-db && npm install" "cd autk-plot && npm install" "cd autk-compute && npm install" "cd autk-provenance && npm install"

install-ex:
	cd examples && npm install

build:
	$(CONCURRENTLY) \
		"cd autk-map && npm run build" \
		"cd autk-db && npm run build" \
		"cd autk-plot && npm run build" \
		"cd autk-compute && npm run build" \
		"cd autk-provenance && npm run build"

dev:
	make install
	make install-ex
	make build
	$(CONCURRENTLY) \
		"cd autk-map && npm run dev-build" \
		"cd autk-db && npm run dev-build" \
		"cd autk-plot && npm run dev-build" \
		"cd autk-compute && npm run dev-build" \
		"cd autk-provenance && npm run dev-build" \
		"cd examples && npm run dev"

map:
	$(CONCURRENTLY) "cd autk-map && npm run build"

db:
	$(CONCURRENTLY) "cd autk-db && npm run build"

plot:
	$(CONCURRENTLY) "cd autk-plot && npm run build"

compute:
	$(CONCURRENTLY) "cd autk-compute && npm run build"

examples:
	$(CONCURRENTLY) "cd examples && npm run dev"

clean:
	@echo "CLEAN_USING_RM_RF"
	rm -rf autk-map/dist autk-map/build autk-map/node_modules
	rm -rf autk-db/dist autk-db/build autk-db/node_modules
	rm -rf autk-plot/dist autk-plot/build autk-plot/node_modules
	rm -rf autk-compute/dist autk-compute/build autk-compute/node_modules
	rm -rf autk-provenance/dist autk-provenance/build autk-provenance/node_modules
	rm -rf examples/dist examples/build examples/node_modules

publish:
	@if [ -z "$(LIB)" ]; then \
		echo "Error: Please specify a library to publish using LIB=<library>"; \
		echo "Usage: make publish LIB=autk-map|autk-db|autk-plot|autk-compute|autk-provenance"; \
		exit 1; \
	fi
	@if [ "$(LIB)" != "autk-map" ] && [ "$(LIB)" != "autk-db" ] && [ "$(LIB)" != "autk-plot" ] && [ "$(LIB)" != "autk-compute" ] && [ "$(LIB)" != "autk-provenance" ]; then \
		echo "Error: LIB must be one of: autk-map, autk-db, autk-plot, autk-compute, autk-provenance"; \
		exit 1; \
	fi
	cd $(LIB) && npm pack && npm publish *.tgz
