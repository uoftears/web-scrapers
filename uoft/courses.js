const fs = require('fs');
const dnsPromise = require('dns').promises;
const cheerio = require('cheerio');
const axios = require('axios');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
// Set up cookie jar;
axiosCookieJarSupport(axios);
const cookieJar = new tough.CookieJar();

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getSetCookie = async (url) => {
  console.log('Setting Cookie');
  await axios.get(
    url,
    { jar: cookieJar, withCredentials: true },
  );
};

const getCourseCodes = async (url) => {
  console.log('Getting Course Codes');
  const courseCodeRegex = /offImg[a-zA-Z0-9]+"/g;
  const { data: { aaData } } = await axios.get(
    url,
    { jar: cookieJar, withCredentials: true },
  );
  const courseCodes = aaData.map(([aTag]) => aTag.match(courseCodeRegex)[0].replace(/(offImg|")/g, ''));
  return courseCodes;
};

const getCourseDetails = async (courseCode, url, tryCount = 0) => {
  try {
    console.log('Getting', courseCode);
    const { data: html } = await axios.get(
      `${url}/${courseCode}`,
      { jar: cookieJar, withCredentials: true },
    );
    const $ = cheerio.load(html);
    const courseName = $('span.uif-headerText-span').text().replace(/[A-Z0-9]+: /, '');
    const division = $('span#u23').text().trim();
    const description = $('span#u32').text().trim();
    const department = $('span#u41').text().trim();
    const preReq = $('span#u50').text().trim();
    const exclusion = $('span#u68').text().trim();
    const level = $('span#u86').text().trim();
    const breadth = $('span#u104').text().trim();
    const campus = $('span#u149').text().trim();
    const term = $('span#u158').text().trim();
    return {
      courseCode,
      courseName,
      division,
      description,
      department,
      preReq,
      exclusion,
      level,
      breadth,
      campus,
      term,
    };
  } catch (err) {
    // Retry 3 times before failing silently
    if (tryCount < 3) await getCourseDetails(courseCode, url, tryCount + 1);
    else console.error(err);
  }
};
// Run Scarper
(async () => {
  try {
    const { address } = await dnsPromise.lookup('coursefinder.utoronto.ca');
    const HOST_URL = `http://${address}/course-search/search`;
    const COOKIE_URL = `${HOST_URL}/courseSearch?viewId=CourseSearch-FormView&methodToCall=start`;
    const COURSE_CODE_URL = `${HOST_URL}/courseSearch/course/search?queryText=&requirements=&campusParam=St.%20George,Scarborough,Mississauga`;
    const COURSE_DETAILS_URL = `${HOST_URL}/courseSearch/coursedetails`;
    await getSetCookie(COOKIE_URL);
    const courseCodes = await getCourseCodes(COURSE_CODE_URL);
    const allCourses = [];
    console.log(courseCodes.length, 'Course Codes');
    for (let i = 0; i < courseCodes.length; i += 10) {
      const chunk = courseCodes.slice(i, i + 10);
      // We want the delay in loop
      // eslint-disable-next-line no-await-in-loop
      const courses = await Promise.all(
        chunk.map((code) => getCourseDetails(code, COURSE_DETAILS_URL)),
      );
      allCourses.push(...courses);
      // Wait 5 seconds;
      // eslint-disable-next-line no-await-in-loop
      await timeout(2500);
    }
    console.log('Writing to file');
    fs.writeFileSync('./courses.json', JSON.stringify(allCourses));
  } catch (err) {
    console.error(err);
  }
})();
