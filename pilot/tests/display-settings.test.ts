import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultDisplaySettings,displayText,validDisplayFont} from '../lib/display-settings';
test('display typography scales text without page zoom and bounds the teacher setting',()=>{
 assert.equal(defaultDisplaySettings.base_font,22);
 for(const value of [16,22,32])assert.equal(validDisplayFont(value),true);
 for(const value of [0,15,33,22.5,NaN,Infinity])assert.equal(validDisplayFont(value),false);
 assert.equal(displayText(20),'calc(20px * var(--pilot-display-scale, 1))');
 assert.equal(displayText('clamp(16px,1vw,32px)'),'calc(clamp(16px,1vw,32px) * var(--pilot-display-scale, 1))');
});
