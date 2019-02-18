/*—————————————————————————–
A simple echo bot for the Microsoft Bot Framework. 
—————————————————————————–*/

var restify = require('restify');
var builder = require('botbuilder');
var Promise = require('bluebird');
var request = require('request-promise').defaults({ encoding: null });
var nodemailer = require('nodemailer');
var Conversation = require('watson-developer-cloud/assistant/v1'); // watson sdk
const image2base64 = require('image-to-base64');

require('dotenv').config({ silent: true });

var contexts;
var workspace = process.env.WORKSPACE_ID || '';

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create the service wrapper
var conversation = new Conversation({
    // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
    // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
    username: process.env.CONVERSATION_USERNAME,
    password: process.env.CONVERSATION_PASSWORD,
    version: '2018-07-10'
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector, function (session) {
    var msg = session.message;
    if (msg.attachments.length) {

        // Message with attachment, proceed to download it.
        // Skype & MS Teams attachment URLs are secured by a JwtToken, so we need to pass the token from our bot.
        var attachment = msg.attachments[0];
        var fileDownload = checkRequiresToken(msg) ? requestWithToken(attachment.contentUrl) : request(attachment.contentUrl);

        fileDownload.then(
            function (response) {
                // Send reply with attachment type & size
                var reply = new builder.Message(session)
                    .text('添付ファイルを受け取りました。');
                session.send(reply);

                // convert image to base64 string
                var imageBase64Sting = new Buffer(response, 'binary').toString('base64');
                // echo back uploaded image as base64 string
                var echoImage = new builder.Message(session).text('こちらのファイルで大丈夫でしょうか？').addAttachment({
                    contentType: attachment.contentType,
                    contentUrl: 'data:' + attachment.contentType + ';base64,' + imageBase64Sting,
                    name: 'Upload image'
                });
                session.send(echoImage);
            }).catch(function (err) {
                console.log('Error downloading attachment:', { statusCode: err.statusCode, message: err.response.statusMessage });
            });

    } else {
        convert(session.message.text, session.message.address.conversation.id, session);
    }

});
/*
bot.on('conversationUpdate', function (activity) {
    // when user joins conversation, send welcome message
    var is_show_welcome = false;
    if (activity.membersAdded) {
        activity.membersAdded.forEach(function (identity) {
            if (identity.id !== activity.address.bot.id) {
                return;
            }
            else {
                is_show_welcome = true;
            }
        });
        if (is_show_welcome) {
            convert("", activity.address.conversation.id, bot, activity.address);
        }
    }
});
*/
function getIntentExample(intent, fn) {
    var example_param = {
        workspace_id: workspace,
        intent: intent
    };
    conversation.listExamples(example_param, function (err, response) {
        if (err) {
            console.error(err);
        } else {
            fn(response.examples[Math.floor(Math.random() * response.examples.length)].text);
            console.log(intent);
            console.log(response.examples[Math.floor(Math.random() * response.examples.length)].text);
        }
    });
}

const waitFor = (ms) => new Promise(r => setTimeout(r, ms));

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
}

function convert(input, conversation_id, sender, address) {
    address = address || "";
    var payload = {
        workspace_id: workspace,
        context: '',
        input: {}
    };
    if (input !== "") {
        payload.input = { text: input };
    }
    var conversationContext = findOrCreateContext(conversation_id);
    if (!conversationContext) {
        conversationContext = {};
        payload.input = {};
    }
    payload.context = conversationContext.watsonContext;
    conversation.message(payload, function (err, response) {
        console.log(JSON.stringify(response, null, 2));
        if (sender instanceof builder.UniversalBot) {
            var replyaddress = new builder.Message()
                .address(address);
        }
        if (err) {
            if (replyaddress !== undefined) {
                replyaddress.text(err);
                sender.send(replyaddress);
            } else {
                sender.send(err);
            }
        } else {
            //console.log(JSON.stringify(response, null, 2));
            const start = async () => {
                await asyncForEach(response.output.generic, async (element) => {
                    var responseType = element.response_type;
                    if (responseType == "text") {
                        var reply = element.text.replace(/\n/g, '\n\n');
                        if (replyaddress !== undefined) {
                            replyaddress.text(reply);
                            sender.send(replyaddress);
                        } else {
                            sender.send(reply);
                        }
                    }
                    else if (responseType == "option") {
                        // オプションのレスポンスを表示
                        if (element.title == "response_data") {
                            // 問い合わせ・申請手順・情報開示・補足事項を表示
                            var reply = "";
                            // []で囲むリンクの部分に＜a＞タグを付与
                            element.options.forEach(option => {
                                var value = option.value.input.text;
                                if ((typeof value) == "string") {
                                    while (value.includes("[") !== false) {
                                        var link = value.substring(value.indexOf("[") + 1, value.indexOf("]")).split('|');
                                        var url = link[0];
                                        var text = link[1]
                                        value = value.replace('[', '<a href="');
                                        value = value.replace('|' + text + ']', '">' + text + "</a>");
                                    }
                                }
                                reply += "<b>" + option.label + "</b>\n\n" + value + "\n\n";
                            });
                        }
                        else {
                            // その他オプションレスポンスを＜u/i＞でリスト化
                            if (element.description != undefined && element.description != "") {
                                var reply = "<u><i>" + element.title + "</i>\n\n" + element.description;
                            }
                            else {
                                var reply = "<u><i>" + element.title + "</i>";
                            }
                            element.options.forEach(option => {
                                reply += ("\n\n<i>" + option.label + "</i>");
                            });
                            reply += "</u>";
                        }
                        // レスポンスを表示する
                        if (replyaddress !== undefined) {
                            replyaddress.text(reply);
                            sender.send(replyaddress);
                        } else {
                            sender.send(reply);
                        }
                    }
                    else if (responseType == "pause") {
                        if (element.typing) {
                            sender.sendTyping();
                        }
                        await waitFor(element.time);
                    }
                    else if (responseType == "image") {
                        image2base64(element.source).then(
                            (response) => {
                                var echoImage = new builder.Message(address).text(element.title).addAttachment({
                                    contentType: 'image/jpeg',
                                    contentUrl: 'data:image/jpeg;base64,' + response,
                                    name: 'image'
                                });
                                sender.send(echoImage);
                            }
                        )
                        .catch(
                            (error) => {
                                console.log(error); //Exepection error....
                            }
                        )
                    }
                });
            }
            start();
            // log表示
            var nodes_list_length = response.output.nodes_visited.length;
            var current_nodeid = response.output.nodes_visited[nodes_list_length - 1];
            console.log(current_nodeid);
            if (current_nodeid == "node_1_1532505891105") {
                console.log(JSON.stringify(response.context.system._node_output_map, null, 2))
                var node_keylist = [];
                for (var k in response.context.system._node_output_map) node_keylist.push(k);
                console.log(current_nodeid);
                if (!(node_keylist.includes("node_1_1530584229651")) || response.context.system.branch_exited) {
                    var params = {
                        workspace_id: workspace,
                        page_limit: 100,
                        sort: '-request_timestamp',
                        //filter: 'request.context.system._node_output_map_s:*%5C%22' + current_nodeid + '%5C%22%5C%3A%5C%5B0%5C%5D*'
                    };
                    conversation.listLogs(params, function (err, response) {
                        if (err) {
                            console.error(err);
                        } else {
                            var ranking = {};
                            response.logs.forEach(log => {
                                var input = log.request.input.text;
                                if (log.response.intents[0] == undefined) {
                                    return;
                                }
                                var intent = log.response.intents[0].intent;
                                if (["RECOMMEND", "Hint", "General_Negative_Feedback", "General_Greetings", "General_Ending", "General_Positive_Feedback", "全部", "General_About_You"].includes(intent)) {
                                    console.log("out----" + intent);
                                    return;
                                }
                                console.log(intent);
                                if (!(intent in ranking)) {
                                    ranking[intent] = 1;
                                }
                                else {
                                    ranking[intent] += 1;
                                }
                            });
                            var items = Object.keys(ranking).map(function (key) {
                                return [key, ranking[key]];
                            });
                            items.sort(function (first, second) {
                                return second[1] - first[1];
                            });

                            // Create a new array with only the first 5 items
                            items = items.slice(0, 5);
                            //console.log(JSON.stringify(response, null, 2));
                            var reply = "<i>よくある質問：</i>\n\n";
                            if (replyaddress !== undefined) {
                                replyaddress.text(reply);
                                sender.send(replyaddress);
                            } else {
                                sender.send(reply);
                            }
                            items.forEach(item => {
                                // 質問サンプルを取得
                                getIntentExample(item[0], function (example) {
                                    var reply = ("<i>" + example + "</i>\n\n");
                                    if (replyaddress !== undefined) {
                                        replyaddress.text(reply);
                                        sender.send(replyaddress);
                                    } else {
                                        sender.send(reply);
                                    }
                                });

                            });
                        }
                    });
                }
            }
            else if (current_nodeid == "node_93_1535011643571") {
                sendmail(response.context);
            }
            conversationContext.watsonContext = response.context;
        }
    });
}
function findOrCreateContext(convId) {
    // Let’s see if we already have a session for the user convId
    if (!contexts)
        contexts = [];

    if (!contexts[convId]) {
        // No session found for user convId, let’s create a new one
        //with Michelin concervsation workspace by default
        contexts[convId] = { workspaceId: workspace, watsonContext: {} };
        //console.log (“new session : ” + convId);
    }
    return contexts[convId];
}

// Request file with Authentication Header
var requestWithToken = function (url) {
    return obtainToken().then(function (token) {
        return request({
            url: url,
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/octet-stream'
            }
        });
    });
};

// Promise for obtaining JWT Token (requested once)
var obtainToken = Promise.promisify(connector.getAccessToken.bind(connector));

var checkRequiresToken = function (message) {
    return message.source === 'skype' || message.source === 'msteams';
};

var sendmail = function(context) {
    if (context.to_address === undefined || context.to_address === null || context.to_address === ""){
        console.log("to address is empty.");
        return;
    }
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'kingarthur9111@gmail.com',
          pass: 'jinrongsheng'
        }
      });

      var address = context.to_address;
      while (address.includes("[") !== false) {
        address.replace("\\", "");
      }
      
      var text = "";
      var data = eval(context.mail_text);
      for (var key in data) {
        if (data.hasOwnProperty(key)) {
            text += key + data[key] + "\r\n";
        }
      }
      console.log(text);
      var mailOptions = {
        from: 'kingarthur9111@gmail.com',
        to: address,
        subject: context.mail_title,
        text: text
      };
      
      transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });
}