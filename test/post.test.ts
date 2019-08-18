import request from 'supertest'
import app from '../src/app'
import { expect } from 'chai'

describe('POST /post', () => {
    it('should return some defined error message with valid parameters', (done) => {
        return request(app).post('/post')
            .field('urlName', 'asf sdf')
            .expect(400)
            .end(function(err, res) {
                expect(res.error).not.to.be.undefined
                done()
            })
    })
})