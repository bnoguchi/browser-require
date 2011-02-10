start-test-server:
	@cd test/nested && $(shell which node) server.js 2>&1 &
stop-test-server:
	@pkill brtest
test-chrome:
	@$(shell which google-chrome) http://localhost:1234/?v=$(shell date +%s)
test-firefox:
	@$(shell which firefox) http://localhost:1234/?v=$(shell date +%s)

.PHONY: start-test-server stop-test-server test-chrome test-firefox
