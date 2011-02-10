start-test-server:
	@cd test && $(shell which node) server.js &
stop-test-server:
	@sudo pkill brtest
test-chrome:
	@$(shell which google-chrome) http://localhost:1234/?v=$(shell date +%s)
test-firefox:
	@$(shell which firefox) http://localhost:1234/?v=$(shell date +%s)

.PHONY: start-test-server stop-test-server test-chrome test-firefox
