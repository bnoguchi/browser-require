CHROME = /opt/google/chrome/google-chrome

FIREFOX = /usr/bin/firefox

test-chrome:
	@$(CHROME) test/index.html
test-firefox:
	@$(FIREFOX) test/index.html

.PHONY: test
