const puppeteer = require("puppeteer");
const axios = require("axios");
const fs = require("fs");

async function authenticate(savedCookies) {
	const browser = await puppeteer.launch({
		headless: false,
		defaultViewport: null,
		args: ["--start-maximized"],
	});
	const page = await browser.newPage();

	if (savedCookies) {
		await page.setCookie(...savedCookies);
	}

	await page.goto("https://instagram.com", { waitUntil: "networkidle2" });

	const innerTextToFind = "Decline optional cookies";
	await page.evaluate((innerTextToFind) => {
		const buttons = document.querySelectorAll("button");
		for (const button of buttons) {
			if (button.innerText === innerTextToFind) {
				button.click();
				return;
			}
		}
	}, innerTextToFind);

	const innerTextToWaitFor = "Save your login information?";
	const waitForInnerText = async (innerText) => {
		const elements = document.querySelectorAll("div");
		for (const element of elements) {
			if (element.innerText.includes(innerText)) {
				return true;
			}
		}
		return false;
	};

	await page.waitForFunction(waitForInnerText, {}, innerTextToWaitFor);

	const cookies = await page.cookies();
	await browser.close();
	return cookies;
}

function getCookieValue(cookies, cookieKey) {
	return cookies.filter((item) => item.name === cookieKey)[0].value;
}

async function getFollowers(cookies) {
	const headers = {
		"x-csrftoken": getCookieValue(cookies, "csrftoken"),
		"x-requested-with": "XMLHttpRequest",
		"x-ig-app-id": "936619743392459",
		Cookie: cookies.reduce((result, item) => {
			return `${item.name}=${item.value}; ${result}`;
		}, ""),
	};

	const userId = getCookieValue(cookies, "ds_user_id");

	let next_max_id = "";
	let users = [];

	do {
		const response = await axios.get(`https://www.instagram.com/api/v1/friendships/${userId}/followers/?count=12&search_surface=follow_list_page&max_id=${next_max_id}`, { headers });
		users = users.concat(response.data.users);
		next_max_id = response.data?.next_max_id;
	} while (next_max_id);

	return users;
}

async function getFollowings(cookies) {
	const headers = {
		"x-csrftoken": getCookieValue(cookies, "csrftoken"),
		"x-requested-with": "XMLHttpRequest",
		"x-ig-app-id": "936619743392459",
		Cookie: cookies.reduce((result, item) => {
			return `${item.name}=${item.value}; ${result}`;
		}, ""),
	};

	const userId = getCookieValue(cookies, "ds_user_id");

	let next_max_id = "";
	let users = [];

	do {
		const response = await axios.get(`https://www.instagram.com/api/v1/friendships/${userId}/following/?count=12&max_id=${next_max_id}`, { headers });
		users = users.concat(response.data.users);
		next_max_id = response.data?.next_max_id;
	} while (next_max_id);

	return users;
}

async function main() {
	const cookies = await authenticate();
	const followers = await getFollowers(cookies);
	const followings = await getFollowings(cookies);

	const users = new Set();
	followings.forEach((user) => users.add(user.username));
	followers.forEach((user) => users.delete(user.username));

	console.log(users);
}

main();
