import React from 'react';
import {themeStyle,useTheme,C} from './Theme';
import {Platform,Text as NativeText,TextProps} from 'react-native';

const family=Platform.OS==='web'?'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif':Platform.OS==='android'?'sans-serif':'System';
export const Text=React.forwardRef<React.ElementRef<typeof NativeText>,TextProps>((props,ref)=>{const {dark}=useTheme();return <NativeText {...props} ref={ref} style={themeStyle([{fontFamily:family,color:C.ink},props.style],dark)}/>;});
