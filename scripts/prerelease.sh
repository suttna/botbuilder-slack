#!/bin/sh

git config --global -l
git config --global user.email circleci@suttna.com
git config --global user.name CircleCI
npm version prerelease -m "Bump to %s [skip ci]"
npm publish --tag next
git push --follow-tags
