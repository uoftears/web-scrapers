const fs = require('fs');
const cheerio = require('cheerio');
const axios = require('axios');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
// Set up cookie jar;
axiosCookieJarSupport(axios);
const cookieJar = new tough.CookieJar();

const HOST_URL = 'http://coursefinder.utoronto.ca/course-search/search';
const HOMEPAGE_URL = `${HOST_URL}/courseSearch?viewId=CourseSearch-FormView&methodToCall=start`;
const QUERY_URL = `${HOST_URL}/courseSearch/course/search?queryText=&requirements=&campusParam=St.%20George,Scarborough,Mississauga`;
const COURSE_DETAILS_URL = `${HOST_URL}/courseSearch/coursedetails`;

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const setCookie = async () => {
  console.log('Setting Cookie');
  await axios.get(
    HOMEPAGE_URL,
    { jar: cookieJar, withCredentials: true },
  );
};

const getCourseCodes = async () => {
  console.log('Getting Course Codes');
  const courseCodeRegex = /offImg[a-zA-Z0-9]+"/g;
  const { data: { aaData } } = await axios.get(
    QUERY_URL,
    { jar: cookieJar, withCredentials: true },
  );
  const courseCodes = aaData.map(([aTag]) => aTag.match(courseCodeRegex)[0].replace(/(offImg|")/g, ''));
  return courseCodes;
};

const getCourseDetails = async (courseCode) => {
  console.log('Getting Course Details', courseCode);
  const { data: html } = await axios.get(
    `${COURSE_DETAILS_URL}/${courseCode}`,
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
};
// Run Scarper
(async () => {
  try {
    await setCookie();
    const courseCodes = await getCourseCodes();
    const allCourses = [];
    for (let i = 0; i < courseCodes.length; i += 10) {
      const chunk = courseCodes.slice(i, i + 10);
      // We want the delay in loop
      // eslint-disable-next-line no-await-in-loop
      const courses = await Promise.all(chunk.map((code) => getCourseDetails(code)));
      allCourses.push(...courses);
      // Wait 5 seconds;
      // eslint-disable-next-line no-await-in-loop
      await timeout(5000);
    }
    console.log('Writing to file');
    fs.writeFileSync('./courses.json', JSON.stringify(allCourses));
  } catch (err) {
    console.error(err);
  }
})();
