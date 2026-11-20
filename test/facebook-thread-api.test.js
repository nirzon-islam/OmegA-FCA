"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createFacebookThreadApi } = require("../src/transport/facebookThreadApi");

const session = { userId: "123456789012345", request: async () => { throw new Error("unused"); } };
const person = { messaging_actor: { id: "987654321", name: "Test User", big_image_src: { uri: "https://example.test/avatar" } } };
const thread = {
  thread_key: { other_user_id: "987654321" }, name: null, unread_count: 2, messages_count: 8,
  all_participants: { nodes: [person] }, thread_admins: [], thread_type: "ONE_TO_ONE",
  updated_time_precise: "1700000000000", customization_info: { participant_customizations: [] },
  last_message: { nodes: [{ snippet: "hello", timestamp_precise: "1700000000000", message_sender: { messaging_actor: { id: "987654321" } } }] }
};
function batch(data) { return [{ o0: { data } }, { error_results: 0, successful_results: 1 }]; }

test("Thread APIs serialize classic FCA requests and normalize thread list/info/history", async () => {
  const calls = [];
  const webClient = { post: async (url, body) => {
    calls.push({ url, body });
    if (url.endsWith("/api/graphqlbatch/")) {
      const query = JSON.parse(body.queries).o0;
      if (query.doc_id === "1349387578499440") return { payload: batch({ viewer: { message_threads: { nodes: [thread] } } }) };
      if (query.query_params.load_messages) return { payload: batch({ message_thread: {
        thread_type: "ONE_TO_ONE",
        messages: { nodes: [{ __typename: "UserMessage", message_id: "m-1", message_sender: { id: "987654321" },
          timestamp_precise: "1700000000001", message: { text: "hello", ranges: [] }, blob_attachments: [] }] }
      } }) };
      return { payload: batch({ message_thread: thread }) };
    }
    return { payload: {} };
  } };
  const api = createFacebookThreadApi({ session, webClient });
  const list = await api.getThreadList(10, null, ["INBOX"]);
  assert.equal(list[0].threadID, "987654321");
  assert.equal(list[0].name, "Test User");
  const info = await api.getThreadInfo("987654321");
  assert.equal(info.unreadCount, 2);
  const history = await api.getThreadHistory("987654321", 20);
  assert.equal(history[0].body, "hello");
  assert.equal(history[0].messageID, "m-1");
  assert.equal(calls.length, 3);
  assert.equal(JSON.parse(calls[0].body.queries).o0.query_params.limit, 10);
});

test("getUserInfo batches IDs and maps the legacy FCA profile shape", async () => {
  let captured;
  const api = createFacebookThreadApi({ session, webClient: { post: async (url, body) => {
    captured = { url, body };
    return { payload: { payload: { profiles: { "987654321": {
      name: "Test User", firstName: "Test", uri: "https://facebook.com/test", is_friend: true
    } } } } };
  } } });
  const result = await api.getUserInfo(["987654321"]);
  assert.equal(result["987654321"].name, "Test User");
  assert.equal(result["987654321"].isFriend, true);
  assert.equal(captured.body["ids[0]"], "987654321");
});

test("group actions, reactions and read receipts use public FCA request shapes", async () => {
  const calls = [];
  const api = createFacebookThreadApi({ session, webClient: { post: async (url, body) => {
    calls.push({ url, body }); return { payload: { success: true } };
  } } });
  await api.addUserToGroup("987654321", "123456789012345");
  await api.removeUserFromGroup("987654321", "123456789012345");
  await api.changeNickname("Tester", "123456789012345", "987654321");
  await api.setMessageReaction(":love:", "mid.1");
  await api.markAsRead("123456789012345");
  assert.equal(calls.length, 5);
  assert.equal(calls[0].body["log_message_data[added_participants][0]"], "fbid:987654321");
  assert.equal(calls[1].body.uid, "987654321");
  assert.equal(calls[2].body.nickname, "Tester");
  assert.match(calls[3].body.variables, /ADD_REACTION/);
  assert.equal(calls[4].body["ids[123456789012345]"], true);
});

test("Thread API validates identifiers and supports error-first callbacks", async () => {
  const api = createFacebookThreadApi({ session, webClient: { post: async () => ({ payload: batch({}) }) } });
  assert.throws(() => api.getThreadInfo("not-an-id"), /numeric Facebook ID/);
  let callbackError;
  api.getThreadInfo("123456789012345", error => { callbackError = error; });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(callbackError instanceof Error);
});

test("httpPost preserves authenticated Facebook response text for GoatBot legacy commands", async () => {
  let captured;
  const raw = '{"data":{"viewer":{"friending_possibilities":{"edges":[]}}}}';
  const api = createFacebookThreadApi({
    session,
    webClient: {
      post: async (url, form) => {
        captured = { url, form };
        return { raw, payload: JSON.parse(raw) };
      }
    }
  });
  const response = await api.httpPost("https://www.facebook.com/api/graphql/", { doc_id: "123", variables: "{}" });
  assert.equal(response, raw);
  assert.equal(captured.url, "https://www.facebook.com/api/graphql/");
  assert.equal(captured.form.doc_id, "123");
});

test("httpPost supports error-first callbacks and rejects non-object forms", async () => {
  const api = createFacebookThreadApi({
    session,
    webClient: { post: async () => ({ raw: "ok" }) }
  });
  assert.throws(() => api.httpPost("https://www.facebook.com/api/graphql/", "not-an-object"), /form must be an object/);
  let result;
  api.httpPost("https://www.facebook.com/api/graphql/", {}, (error, value) => {
    assert.equal(error, null);
    result = value;
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(result, "ok");
});

test("unsendMessage uses the authenticated Facebook unsend endpoint", async () => {
  let captured;
  const api = createFacebookThreadApi({
    session,
    webClient: { post: async (url, body) => {
      captured = { url, body };
      return { payload: { success: true } };
    } }
  });
  const result = await api.unsendMessage("mid.123");
  assert.equal(captured.url, "https://www.facebook.com/messaging/unsend_message/");
  assert.deepEqual(captured.body, { message_id: "mid.123" });
  assert.deepEqual(result, { success: true });
});

test("unsendMessage rejects invalid IDs and reports Facebook action errors", async () => {
  const api = createFacebookThreadApi({
    session,
    webClient: { post: async () => ({ payload: { error: "rejected" } }) }
  });
  assert.throws(() => api.unsendMessage(""), /messageID is invalid/);
  await assert.rejects(api.unsendMessage("mid.123"), error => error.code === "FCA_FACEBOOK_REQUEST_REJECTED");
});

test("thread title, color and emoji actions use the authenticated customization endpoints", async () => {
  const calls = [];
  const api = createFacebookThreadApi({
    session,
    webClient: { post: async (url, body) => {
      calls.push({ url, body });
      return { payload: { success: true } };
    } }
  });
  await api.setTitle("Test Group", "123456789012345");
  await api.changeThreadColor("196241301102133", "123456789012345");
  await api.changeThreadEmoji("🎉", "123456789012345");
  assert.equal(calls[0].url, "https://www.facebook.com/messaging/set_thread_name/");
  assert.equal(calls[0].body.thread_name, "Test Group");
  assert.equal(calls[0].body.thread_fbid, "123456789012345");
  assert.equal(calls[1].url, "https://www.facebook.com/messaging/save_thread_color/?source=thread_settings&dpr=1");
  assert.equal(calls[1].body.color_choice, "");
  assert.equal(calls[2].url, "https://www.facebook.com/messaging/save_thread_emoji/?source=thread_settings&dpr=1");
  assert.equal(calls[2].body.emoji_choice, "🎉");
});

test("thread customization methods validate input and normalize Facebook errors", async () => {
  const api = createFacebookThreadApi({
    session,
    webClient: { post: async () => ({ payload: { error: 1545012 } }) }
  });
  assert.throws(() => api.setTitle("x", "bad"), /numeric Facebook ID/);
  assert.throws(() => api.changeThreadColor("x".repeat(65), "123456789012345"), /theme ID/);
  assert.throws(() => api.changeThreadEmoji("x".repeat(17), "123456789012345"), /up to 16/);
  await assert.rejects(api.setTitle("Test", "123456789012345"), error => error.code === "FCA_FACEBOOK_REQUEST_REJECTED");
  await assert.rejects(api.changeThreadColor("#ff0000", "123456789012345"), error => error.code === "FCA_FACEBOOK_REQUEST_REJECTED");
  await assert.rejects(api.changeThreadEmoji("🎉", "123456789012345"), error => error.code === "FCA_FACEBOOK_REQUEST_REJECTED");
});
