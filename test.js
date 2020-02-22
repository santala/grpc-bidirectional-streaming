/*
* Test for URIFetch service
*
* We spin up a test server to which we point the service to download content from.
* Then, we query the URIFetch service to send requests to the test server that take variable times to complete.
*
* */

const config = require("./config");

const assert = require('assert');

const grpcServer = require("./server");

const PROTO_PATH = __dirname + "/urifetch.proto";
const grpc = require("grpc");
const protoLoader = require("@grpc/proto-loader");

const packageDefinition = protoLoader.loadSync(
    PROTO_PATH,
    {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    }
);
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const uriFetch = protoDescriptor.urifetch;

const http = require("http");

const testServer = http.createServer(function (request, response) {
    // The test server waits the number of milliseconds given in the url parameter ‘wait’, and then returns that number.

    const url = new URL(request.url, `http://${request.headers.host}`)

    const wait = parseInt(url.searchParams.get("wait") || 0);

    setTimeout(() => {
            response.write("" + wait);
            response.end();
    }, wait);
});

testServer.on("listening", () => {
    // Test server ready; run tests

    const testServerPort = testServer.address().port;
    console.log("Test server listening at " + testServerPort);

    const client = new uriFetch.URIFetch("localhost:"+config.port, grpc.credentials.createInsecure());

    const call = client.streamContent();

    const tests = [0, 500, 1000, 2000, 4000];

    call.on("data", (uriContent) => {
        // Confirm that messages arrive in the correct order and with the correct value
        const test = tests.shift();
        assert.equal(test, uriContent.content, "Wrong content received");
        console.log("Received: " + JSON.stringify(uriContent));

        if (!tests.length) {
            // Everything received, shut down servers
            console.log("Tests completed, shutting down servers.");
            grpcServer.tryShutdown(() => {});
            testServer.close();
        }
    });

    call.on("error", (err) => {
        console.log("Error: " + err);
    });

    tests.forEach(t => {
        const uri = "http://localhost:" + testServerPort + "?wait=" + t;
        call.write({ uri: uri });
    });

    // Inform the server that connection can be closed.
    // The server should still complete all of the requests.
    call.end();
});


testServer.listen();



