# grpc-bidirectional-streaming

Demo of a service which receives a stream of URLs, fetches the contents of those URLs and returns the contents to the caller.
The fetch operation is done asynchronously to enable the caller to send additional fetch requests freely.

The repository includes

- Node.js source code for the API and a Dockerfile (tested with docker build > docker run)
- test.js which tests the API (can be run with “npm test”)
- test-client.js (ignored by Docker), which can be run independently (“node test-client.js”) for manual testing of individual URIs. Usage: “localhost:3000/?uri=http://apple.com”
