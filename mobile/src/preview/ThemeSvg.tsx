import React from 'react';
import Svg,* as S from 'react-native-svg';
import {themeColor,useTheme} from './Theme';
function themed(Component:any){return React.forwardRef<any,any>((props,ref)=>{const {dark}=useTheme();return <Component {...props} ref={ref} fill={themeColor(props.fill,dark,'fill')} stroke={themeColor(props.stroke,dark,'stroke')} color={themeColor(props.color,dark)} stopColor={themeColor(props.stopColor,dark,'stopColor')}/>;});}
export default themed(Svg);
export const Circle=themed(S.Circle),Path=themed(S.Path),Rect=themed(S.Rect),Line=themed(S.Line),G=themed(S.G),Defs=S.Defs,LinearGradient=S.LinearGradient,Stop=themed(S.Stop);
