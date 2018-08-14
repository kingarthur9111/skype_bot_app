//dumy
var msg = { "payload": { "intents": [{ "intent": "General_Greetings", "confidence": 1 }], "entities": [], "input": { "text": "こんにちは" }, "output": { "text": ["Directory Serviceへようこそ！", "何を探したいでしょうか？"], "nodes_visited": ["node_2_1532579942343", "node_1_1530602514512"], "log_messages": [] }, "context": { "conversation_id": "7755c559-20ca-4e95-96e8-8ff3aac06af3", "system": { "dialog_stack": [{ "dialog_node": "node_1_1530602514512" }], "dialog_turn_counter": 6, "dialog_request_counter": 6 }, "hr_root_contact": "[skype:xxxxx?chat|Chat HR Group]\n\n[skype:xxxxx?call|Call HR Group]", "is_root_contact": "[skype:xxxxx?chat|Chat IS Group]\n\n[skype:xxxxx?call|Call IS Group]", "hr_root_info_url": "[https://xxxxx.com|HRイントラネット]", "is_root_info_url": "[https://xxxxx.com|ISイントラネット]", "hr_admin_appendix": "xxxxから出向している方は[https://xxxxx.com|APIのHP]をご参照いただき、フォーマットをダウロードの上、xxxxx人事部にご提出ください。", "hr_admin_address_all": "①『人事情報申請書』の中で「住所変更」、「通勤費変の変更」、「扶養控除等申告書」を選択\n\n②必要事項を記入\n\n③[xxxxxx@xxxx.com|人事メールアドレス]にファイルを提出", "hr_admin_address_family": "①『人事情報申請書』の中で「住所変更」を選択\n\n②必要事項を記入\n\n③[xxxxxx@xxxxx.com|人事メールアドレス]にファイルを提出", "hr_admin_address_jyumin": "①『人事情報申請書』の中で「住所変更」、「扶養控除等申告書」を選択\n\n②必要事項を記入\n\n③[xxxxxx@xxxxx.com|人事メールアドレス]にファイルを提出", "hr_admin_address_current": "①『人事情報申請書』の中で「住所変更」、「通勤費変の変更」、「扶養控除等申告書」を選択\n\n②必要事項を記入\n\n③[xxxxxx@xxxx.com|人事メールアドレス]にファイルを提出", "hr_admin_application_file": "[https://xxxxx.com|人事情報申請書]", "hr_admin_private_appendix": "「個人連絡先変更申請」はWorkdayで別途行ってください。\n\nxxxxから出向している方は[https://xxxxx.com|APIのHP]をご参照いただき、フォーマットをダウロードの上、xxxxx人事部にご提出ください。" } } };

//レスポンス変換
var reply = "";
var loop = 0;
msg.payload.output.generic.forEach(element => {
    var responseType = element.response_type;
    if (responseType == "text") {
        if (loop != 0) {
            reply += "<br>";
            reply += element.text.replace(/\n/g, '<br>');
        }
        else {
            reply += element.text.replace(/\n/g, '<br>');
        }
        loop++;
    }
    else if (responseType == "option") {
        // オプションのレスポンスを表示
        if (element.title == "response_data") {
            // 問い合わせ・申請手順・情報開示・補足事項を表示
            // []で囲むリンクの部分に＜a＞タグを付与
            element.options.forEach(option => {
                var value = option.value.input.text;
                while (value.includes("[") !== false) {
                    var link = value.substring(value.indexOf("[") + 1, value.indexOf("]")).split('|');
                    var url = link[0];
                    var text = link[1]
                    value = value.replace('[', '<a href="');
                    value = value.replace('|' + text + ']', '">' + text + "</a>");
                    value = value.replace(/\n\n/g, '<br>');
                }
                
                if (loop != 0) {
                    reply += "<br><b>" + option.label + "</b><br>" + value;
                }
                else {
                    reply += "<b>" + option.label + "</b><br>" + value;
                }
            });
            loop++;
        }
        else {
            // その他オプションレスポンスを＜u/i＞でリスト化
            if (loop != 0) {
                if (element.description !== undefined && element.description !== "") {
                    reply += "<br>" + element.title + "<br>" + element.description;
                }
                else {
                    reply += "<br>" + element.title;
                }
                element.options.forEach(option => {
                    reply += ("<br>" + option.label);
                });
            }
            else {
                if (element.description !== undefined && element.description !== "") {
                    reply += element.title + "<br>" + element.description;
                }
                else {
                    reply += element.title;
                }
                element.options.forEach(option => {
                    reply += ("<br>" + option.label);
                });
            }
            loop++;
        }
    }
});
msg.payload = reply;
return msg;