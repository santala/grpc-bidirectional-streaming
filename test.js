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
const client = new uriFetch.URIFetch("localhost:"+config.port, grpc.credentials.createInsecure());

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

function shutDownServers() {
    grpcServer.tryShutdown(() => {});
    testServer.close();
}


function getContents(uris) {
    return new Promise((resolve, reject) => {
        const call = client.streamContent();
        const responses = [];

        call.on("error", reject);

        call.on("data", (response) => {
            console.log("Received response:", response);
            responses.push(response);
        });

        call.on("end", () => {
            resolve(responses);
        });

        uris.forEach(uri => {
            const request = { uri: uri };
            console.log("Sending request:", request);
            call.write(request);
        });

        // Inform the server that all requests have been sent.
        // The server should still complete all of the requests.
        call.end();
    });
}


async function runTests(tests) {
    const testServerPort = testServer.address().port;
    const makeURI = wait => "http://localhost:" + testServerPort + "?wait=" + wait;

    let results = null;
    try {
        // Test that the service fulfills requests
        setTimeout(() => {
            assert.notStrictEqual(results, null, "Server not responding.");
        }, Math.max(0, ...tests) + 1000);

        results = await getContents(tests.map(makeURI));
    } catch (e) {
        console.error(e);
    }

    const resultContents = (results || []).map(r => r.content);

    try {
        assert.equal(results.length, tests.length, "Wrong number of results.");
        tests.forEach(test => {
            assert.equal(resultContents.includes(""+test), true, "Something not received.");
        });
    } catch (e) {
        console.error(e);
    }


}


testServer.on("listening", async () => {
    // Test server ready; run tests
    const testServerPort = testServer.address().port;
    console.log("Test server listening at " + testServerPort);

    const tests = [0, 500, 1000, 2000];
    await runTests(tests);
    await runTests(tests.reverse());
    await runTests([]);

    console.log("Tests completed, shutting down servers");
    shutDownServers();
});


testServer.listen();



