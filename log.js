var ranking = {};
msg.payload.logs.forEach(log => {
    var input = log.request.input.text;
    if (log.response.intents[0] === undefined) {
        return;
    }
    var intent = log.response.intents[0].intent;
    if (["RECOMMEND","Hint","General_Negative_Feedback", "General_Greetings", "General_Ending", "General_Positive_Feedback", "全部", "General_About_You"].includes(intent)) {
        return;
    }
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
msg.items = items.slice(0, 5);

return msg;