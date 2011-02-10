CHROME = /opt/google/chrome/google-chrome

FIREFOX = /usr/bin/firefox

start-test-server:
	@cd test && $(shell which node) server.js &
stop-test-server:
	@sudo pkill brtest
test-chrome:
	@$(CHROME) http://localhost:1234/
test-firefox:
	@$(FIREFOX) http://localhost:1234/

.PHONY: test
