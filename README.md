# Test Infra metrics screen grabber
Takes screen shots of a set of URLs that display operational metrics for test infrastructure
that runs CI for the Kubernetes project.

Screenshots taken as PNG files are placed in the screenshots directory

## Getting started
Run the following commands at shell

```
npm install
mkdir screenshots
node grab-charts.js
cd screenshots
ls -lrt
```
